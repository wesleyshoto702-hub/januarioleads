import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "migration_gate", Path(__file__).resolve().parents[2] / "scripts/verify-migration-ledger.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class LedgerGateTests(unittest.TestCase):
    def setUp(self):
        self.expected = {"20260928194018": {"name": "add_private_access_allowlist", "hash": "a"*32}}
        self.local = {"20261103220000": "20261103220000_allow_presence_site_rate_limit.sql"}
        self.rows = [
            {"version": "20260928194018", "name": "add_private_access_allowlist", "hash": "a"*32},
            {"version": "20261103220000", "name": "allow_presence_site_rate_limit", "hash": "b"*32},
        ]

    def test_expected_history_is_accepted_but_not_clean(self):
        self.assertEqual(gate.audit_ledger(self.rows, self.expected, self.local), (1, 2, 1))
        with self.assertRaisesRegex(RuntimeError, "db push blocked"):
            gate.audit_ledger(self.rows, self.expected, self.local, True)

    def test_extra_remote_migration_fails(self):
        with self.assertRaisesRegex(RuntimeError, "unexpected_remote=1"):
            gate.audit_ledger(self.rows + [
                {"version": "20261104220000", "name": "unexpected", "hash": "c"*32}
            ], self.expected, self.local)

    def test_unrecorded_local_migration_fails(self):
        with self.assertRaisesRegex(RuntimeError, "local_only=1"):
            gate.audit_ledger(self.rows, self.expected, {**self.local, "20261104230000": "20261104230000_new.sql"})

    def test_historical_sql_metadata_drift_fails(self):
        changed = [{**self.rows[0], "hash": "d"*32}, self.rows[1]]
        with self.assertRaisesRegex(RuntimeError, "changed_historical_metadata=1"):
            gate.audit_ledger(changed, self.expected, self.local)

    def test_history_removed_fails(self):
        with self.assertRaisesRegex(RuntimeError, "known_missing=1"):
            gate.audit_ledger([self.rows[1]], self.expected, self.local)

    def test_duplicate_timestamp_fails(self):
        with self.assertRaisesRegex(RuntimeError, "Duplicate"):
            gate.audit_ledger(self.rows + [self.rows[1]], self.expected, self.local)

    def test_detect_duplicate_local_files(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            (path/"20261103220000_one.sql").touch()
            (path/"20261103220000_two.sql").touch()
            with self.assertRaisesRegex(RuntimeError, "Duplicate"):
                gate.read_local_versions(path)


if __name__ == "__main__":
    unittest.main()
