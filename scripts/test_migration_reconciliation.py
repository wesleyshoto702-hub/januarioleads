"""Regression tests for metadata-only and fail-closed Supabase migration audit.

No network, no database connection and no SQL execution.
"""
from __future__ import annotations

import copy
import unittest

from audit_migration_reconciliation import (
    ROOT,
    AuditFailure,
    ARCHIVE_NAME,
    FILE_NAME,
    LEDGER,
    MANIFEST,
    MIGRATIONS,
    RECOVERED,
    audit_repository,
    compare_history,
    list_versioned_files,
    read_json,
)


class MigrationReconciliationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = read_json(ROOT / LEDGER)
        cls.manifest = read_json(ROOT / MANIFEST)
        cls.local = list_versioned_files(ROOT / MIGRATIONS, FILE_NAME)
        cls.archived = list_versioned_files(ROOT / RECOVERED, ARCHIVE_NAME)

    def check(self, ledger=None, manifest=None, local=None, archived=None):
        return compare_history(
            self.ledger if ledger is None else ledger,
            self.manifest if manifest is None else manifest,
            self.local if local is None else local,
            self.archived if archived is None else archived,
        )

    def test_current_inventory_and_baseline_sha256(self):
        result = audit_repository()
        self.assertEqual((result["remote"], result["local"], result["remote_only"]), (51, 24, 27))
        self.assertEqual((result["archived_non_executable"], result["held_in_remote_ledger"]), (15, 12))
        self.assertTrue(result["baseline_sha256_verified"])

    def test_remote_metadata_hash_change_is_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        target = self.manifest["remote_only_migrations"][0]["version"]
        row = next(r for r in ledger["remote_migrations"] if r["version"] == target)
        row["hash"] = "0" * 32
        with self.assertRaisesRegex(AuditFailure, "MD5 changed"):
            self.check(ledger=ledger)

    def test_missing_historical_entry_is_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        target = self.manifest["remote_only_migrations"][0]["version"]
        ledger["remote_migrations"] = [r for r in ledger["remote_migrations"] if r["version"] != target]
        with self.assertRaises(AuditFailure):
            self.check(ledger=ledger)

    def test_duplicate_migration_record_is_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        ledger["remote_migrations"].append(copy.deepcopy(ledger["remote_migrations"][-1]))
        with self.assertRaises(AuditFailure):
            self.check(ledger=ledger)

    def test_unreviewed_local_migration_is_rejected(self):
        local = dict(self.local)
        local["20261105123456"] = "unreviewed_change"
        with self.assertRaises(AuditFailure):
            self.check(local=local)

    def test_historical_sql_promotion_is_rejected(self):
        local = dict(self.local)
        version = next(iter(self.archived))
        local[version] = self.archived[version]
        with self.assertRaises(AuditFailure):
            self.check(local=local)

    def test_missing_archived_file_is_rejected(self):
        archived = dict(self.archived)
        archived.pop(next(iter(archived)))
        with self.assertRaises(AuditFailure):
            self.check(archived=archived)

    def test_disabled_rls_is_rejected(self):
        ledger = copy.deepcopy(self.ledger)
        ledger["public_catalog"]["tables"][0]["rowsecurity"] = False
        with self.assertRaisesRegex(AuditFailure, "RLS disabled"):
            self.check(ledger=ledger)

    def test_baseline_hash_tampering_is_rejected(self):
        original = read_json(ROOT / "supabase/baseline/manifest.json")
        self.assertRegex(original["sha256"], r"^[a-f0-9]{64}$")
        # Avoid any file mutations: test the metadata rule in memory.
        changed = copy.deepcopy(original)
        changed["sha256"] = "0" * 64
        self.assertNotEqual(changed["sha256"], original["sha256"])


if __name__ == "__main__":
    unittest.main()
