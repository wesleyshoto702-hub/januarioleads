"""Detect production migration drift without executing historical SQL.

CI accepts only the 27 audited remote-only versions in manifest; unexpected
remote migrations or any unrecorded local version fail closed.
--require-clean is a hard gate for any future deployment requiring db push.
"""
import argparse
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "docs/migration-history/expected-remote-only.json"
MIGRATION_DIR = ROOT / "supabase/migrations"


def read_local_versions(directory=MIGRATION_DIR):
    versions = {}
    for path in directory.glob("*.sql"):
        version = path.name[:14]
        if len(version) != 14 or not version.isdecimal() or path.name[14:15] != "_":
            raise RuntimeError("Invalid migration filename in supabase/migrations")
        if version in versions:
            raise RuntimeError("Duplicate migration timestamp in supabase/migrations")
        versions[version] = path.name
    return versions


def audit_ledger(rows, expected, local, require_clean=False):
    if not isinstance(rows, list) or any(not isinstance(x, dict) for x in rows):
        raise RuntimeError("Unexpected ledger response")
    remote = {}
    for item in rows:
        version, name, digest = item.get("version"), item.get("name"), item.get("hash")
        if not isinstance(version, str) or not version.isdecimal() or len(version) != 14:
            raise RuntimeError("Invalid version in remote ledger")
        if not isinstance(name, str) or not isinstance(digest, str):
            raise RuntimeError("Remote migration metadata missing")
        if version in remote:
            raise RuntimeError("Duplicate remote migration timestamp")
        remote[version] = {"name": name, "hash": digest}

    local_only = sorted(set(local) - set(remote))
    remote_only = sorted(set(remote) - set(local))
    unexpected = sorted(set(remote_only) - set(expected))
    missing_expected = sorted(set(expected) - set(remote_only))
    changed = sorted(version for version in set(remote_only) & set(expected) if remote[version] != expected[version])
    if local_only or unexpected or missing_expected or changed:
        raise RuntimeError(
            f"Migration ledger drift: local_only={len(local_only)}, "
            f"unexpected_remote={len(unexpected)}, known_missing={len(missing_expected)}, "
            f"changed_historical_metadata={len(changed)}"
        )
    if require_clean and remote_only:
        raise RuntimeError(
            f"db push blocked: {len(remote_only)} remote-only historical migrations. "
            "Build a tested baseline and reconcile before pushing."
        )
    return len(local), len(remote), len(remote_only)


def check(require_clean=False):
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN required for read-only ledger verification")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("project_ref") != "czkazbianiflhldenhcj":
        raise RuntimeError("Manifest project mismatch")
    entries = manifest.get("remote_only_migrations")
    if not isinstance(entries, list) or len(entries) != 27:
        raise RuntimeError("Incomplete reviewed migration manifest")
    expected = {x["version"]: {"name": x["name"], "hash": x["hash"]} for x in entries}
    if len(expected) != len(entries):
        raise RuntimeError("Duplicate audited migration timestamps")

    query = """SELECT version, name,
        md5(coalesce(array_to_string(statements, E'\\n'), '')) AS hash
        FROM supabase_migrations.schema_migrations ORDER BY version;"""
    request = Request(
        "https://api.supabase.com/v1/projects/czkazbianiflhldenhcj/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            rows = json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f"Migration ledger read failed: API HTTP {exc.code}") from None
    except (URLError, TimeoutError, ValueError, TypeError):
        raise RuntimeError("Migration ledger read failed") from None

    local = read_local_versions()
    counts = audit_ledger(rows, expected, local, require_clean)
    print(
        f"Read-only ledger check passed: {counts[0]} local, "
        f"{counts[1]} remote, {counts[2]} audited remote-only."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-clean", action="store_true")
    args = parser.parse_args()
    try:
        check(args.require_clean)
    except RuntimeError as error:
        parser.exit(1, str(error) + "\n")
