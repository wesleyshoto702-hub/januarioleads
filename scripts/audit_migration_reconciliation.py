#!/usr/bin/env python3
"""Offline, fail-closed audit of Supabase migration inventory and schema baseline.

This code never connects to Supabase, executes SQL, copies secret statements,
repairs remote history, or modifies any files. Ledger metadata was captured
read-only and is explicitly *not* a source for automatically running migrations.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = "docs/migration-history/ledger-metadata-20261105.json"
MANIFEST = "docs/migration-history/expected-remote-only.json"
SCHEMA_MANIFEST = "supabase/baseline/manifest.json"
SCHEMA_SQL = "supabase/baseline/20261103-public.sql"
MIGRATIONS = "supabase/migrations"
RECOVERED = "docs/migration-history/recovered"
PROJECT_REF = "czkazbianiflhldenhcj"
VERSION = re.compile(r"^[0-9]{14}$")
DIGEST = re.compile(r"^[a-f0-9]{32}$")
FILE_NAME = re.compile(r"^([0-9]{14})_([a-z0-9_]+)\.sql$")
ARCHIVE_NAME = re.compile(r"^([0-9]{14})_([a-z0-9_]+)\.sql\.txt$")


class AuditFailure(RuntimeError):
    """Explicit refusal to allow potentially unsafe migration assumptions."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AuditFailure(message)


def read_json(path: Path) -> dict:
    result = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(result, dict), f"Expected a JSON object: {path.name}")
    return result


def validate_ledger(snapshot: dict) -> dict[str, dict]:
    require(snapshot.get("project_ref") == PROJECT_REF, "Project ref mismatch")
    rows = snapshot.get("remote_migrations")
    require(isinstance(rows, list) and len(rows) == 51, "Expected 51 historical ledger metadata entries")
    require(snapshot.get("source") and "Read-only" in snapshot["source"], "Unknown ledger evidence source")
    versions = []
    normalized = {}
    for row in rows:
        require(isinstance(row, dict), "Invalid ledger entry")
        version, name, digest = row.get("version"), row.get("name"), row.get("hash")
        require(isinstance(version, str) and VERSION.fullmatch(version) is not None, "Invalid ledger version")
        require(isinstance(name, str) and re.fullmatch(r"[a-z0-9_]+", name) is not None, "Invalid migration name")
        require(isinstance(digest, str) and DIGEST.fullmatch(digest) is not None, "Invalid hash metadata")
        require(type(row.get("statement_count")) is int and row["statement_count"] > 0, "Empty ledger statements")
        require(version not in normalized, f"Duplicate ledger version {version}")
        versions.append(version)
        normalized[version] = row
    require(versions == sorted(versions), "Ledger evidence not chronologically ordered")
    require(not any(k in snapshot for k in ("statements", "sql", "secrets")), "Raw SQL/secrets in snapshot")
    return normalized


def compare_history(snapshot: dict, manifest: dict, local: dict[str, str], archives: dict[str, str]) -> dict:
    remote = validate_ledger(snapshot)
    require(manifest.get("project_ref") == PROJECT_REF, "Remote-only manifest is for another project")
    entries = manifest.get("remote_only_migrations")
    require(isinstance(entries, list) and len(entries) == 27, "Expected 27 reviewed historical versions")
    missing = {}
    for row in entries:
        v, name, digest = row.get("version"), row.get("name"), row.get("hash")
        require(isinstance(v, str) and VERSION.fullmatch(v) is not None, "Invalid missing version")
        require(v not in missing, "Duplicate missing migration version")
        require(v in remote, f"Missing remotely recorded migration: {v}")
        require(name == remote[v]["name"] and digest == remote[v]["hash"],
                f"Historic version/name/MD5 changed: {v}")
        missing[v] = name

    require(len(local) == 24, f"Expected 24 known local migrations; got {len(local)}")
    require(set(local) <= set(remote), "Local-only migration found: do not run db push")
    for version, name in local.items():
        require(remote[version]["name"] == name, f"Local migration name drift at {version}")

    remote_only = set(remote) - set(local)
    require(remote_only == set(missing), "Remote-only versions do not match the reviewed inventory")
    require(not set(local).intersection(missing), "A sensitive historic migration became executable")
    require(len(archives) == 15, "Expected exactly 15 non-executable reviewed SQL archives")
    require(set(archives) <= set(missing), "An unexpected historical SQL archive was added")
    for version, name in archives.items():
        require(missing[version] == name, f"Archived SQL name mismatch: {version}")
    withheld = remote_only - set(archives)
    require(len(withheld) == 12, "Expected 12 remote-only SQL histories withheld from repository")

    cat = snapshot.get("public_catalog")
    require(isinstance(cat, dict), "Missing public catalog summary")
    tables = cat.get("tables")
    require(isinstance(tables, list) and len(tables) == 17, "Unexpected number of public tables")
    require(all(t.get("rowsecurity") is True for t in tables), "A public table has RLS disabled")
    require(len({t["tablename"] for t in tables}) == 17, "Duplicate public table names")
    require(sum(t["policies"] for t in tables) == 38, "Unexpected public policy count")
    require(sum(t["indexes"] for t in tables) == 47, "Unexpected public index count")
    require(cat.get("functions") == 4 and cat.get("triggers") == 2, "Unexpected function/trigger count")
    columns = cat.get("columns")
    require(isinstance(columns, list) and len(columns) == 17, "Missing public column-layout fingerprints")
    require({x.get("table_name") for x in columns} == {t["tablename"] for t in tables},
            "Public table/column fingerprint inventory differs")
    for item in columns:
        require(type(item.get("columns")) is int and item["columns"] > 0,
                "Invalid table column count")
        value = item.get("column_fingerprint")
        require(isinstance(value, str) and DIGEST.fullmatch(value) is not None,
                "Invalid column-layout fingerprint")

    return {
        "remote": len(remote),
        "local": len(local),
        "remote_only": len(remote_only),
        "archived_non_executable": len(archives),
        "held_in_remote_ledger": len(withheld),
        "public_tables_with_rls": len(tables),
        "public_policies": 38,
    }


def list_versioned_files(directory: Path, pattern: re.Pattern) -> dict[str, str]:
    require(directory.is_dir(), f"Missing directory {directory}")
    found = {}
    for path in directory.iterdir():
        if not path.is_file():
            continue
        match = pattern.fullmatch(path.name)
        require(match is not None, f"Unexpected filename: {path.name}")
        version, name = match.groups()
        require(version not in found, f"Duplicate version: {version}")
        found[version] = name
    return found


def check_baseline_integrity(baseline_manifest: dict, baseline_sql: bytes) -> None:
    """Validate the immutable public-only baseline before tests or future changes."""
    require(baseline_manifest.get("schema") == "public", "Baseline must be public schema only")
    require(baseline_manifest.get("tables") == 17 and
            baseline_manifest.get("policies") == 38 and
            baseline_manifest.get("functions") == 4, "Baseline manifest inventory drift")
    require(baseline_manifest.get("historical_migration_boundary") == "20261103181928",
            "Unexpected baseline migration boundary")
    reference_hash = baseline_manifest.get("sha256")
    require(isinstance(reference_hash, str) and re.fullmatch(r"[a-f0-9]{64}", reference_hash) is not None,
            "Invalid baseline hash")
    actual_hash = hashlib.sha256(baseline_sql).hexdigest()
    require(actual_hash == reference_hash,
            "Baseline SHA-256 mismatch: do not modify the original schema snapshot")


def audit_repository(root: Path = ROOT) -> dict:
    ledger = read_json(root / LEDGER)
    manifest = read_json(root / MANIFEST)
    local = list_versioned_files(root / MIGRATIONS, FILE_NAME)
    archives = list_versioned_files(root / RECOVERED, ARCHIVE_NAME)
    for version, name in archives.items():
        path = root / RECOVERED / f"{version}_{name}.sql.txt"
        # Do not accidentally promote historic DML/Cron/Vault to active migrations.
        require("NÃO EXECUTAR" in path.read_text(encoding="utf-8")[:320],
                f"Missing explicit warning in {path.name}")
    counts = compare_history(ledger, manifest, local, archives)

    baseline_manifest = read_json(root / SCHEMA_MANIFEST)
    check_baseline_integrity(baseline_manifest, (root / SCHEMA_SQL).read_bytes())
    counts["baseline_sha256_verified"] = True
    return counts


def main() -> int:
    try:
        counts = audit_repository()
    except (AuditFailure, OSError, json.JSONDecodeError) as exc:
        print(f"BLOCKED migration reconciliation: {exc}", file=sys.stderr)
        return 1
    print(
        "Read-only migration inventory verified: "
        f"{counts['remote']} ledger entries, {counts['local']} local, "
        f"{counts['remote_only']} remote-only ("
        f"{counts['archived_non_executable']} archived, "
        f"{counts['held_in_remote_ledger']} withheld), "
        "baseline SHA-256 valid."
    )
    print("IMPORTANT: db push / migration repair remain BLOCKED until a separate approved plan.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
