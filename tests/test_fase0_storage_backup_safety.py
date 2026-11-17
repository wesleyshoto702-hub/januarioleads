"""Tests for production Storage backup. All data and HTTP calls are synthetic."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SOURCE = Path(__file__).resolve().parents[1] / "scripts" / "fase0-backup-storage-producao.py"
spec = importlib.util.spec_from_file_location("januario_storage_backup_safety", SOURCE)
assert spec and spec.loader
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class StorageSafetyTests(unittest.TestCase):
    def test_target_is_pinned_and_no_network_without_explicit_run(self):
        src = SOURCE.read_text(encoding="utf-8")
        self.assertEqual(storage.PROD_REF, "czkazbianiflhldenhcj")
        self.assertEqual(storage.BASE, "https://czkazbianiflhldenhcj.supabase.co")
        self.assertEqual(storage.BUCKET, "prompt-visual-references")
        self.assertNotIn("prlrxjothrslhswpkoza", src)
        self.assertNotIn('method="DELETE"', src)
        self.assertNotIn('method="PUT"', src)
        self.assertNotIn("Authorization", src)
        self.assertIn("getpass.getpass", src)
        self.assertIn("sha256", src)
        self.assertNotIn("subprocess", src)

    def test_rejects_unsafe_names(self):
        for name in ("", ".", "..", "../x", "a/b", "foo\\bar", "file:name",
                     "CON", "NUL.txt", "text.", "name ", "a\x00b"):
            with self.subTest(name=name):
                self.assertFalse(storage.valid_segment(name))
        for name in ("photo.png", "foto 1.jpg", "folder-test", "área.png"):
            self.assertTrue(storage.valid_segment(name))

    def test_target_outside_repo_requires_explicit_encrypted_volume_confirmation(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(storage.BackupBlocked):
                storage.checked_output_directory(d, confirmed_encrypted=False)
            self.assertEqual(
                storage.checked_output_directory(d, confirmed_encrypted=True),
                Path(d).resolve(),
            )
        with self.assertRaises(storage.BackupBlocked):
            storage.checked_output_directory(str(storage.REPO), confirmed_encrypted=True)

    def test_recursive_listing_handles_folders_and_validates_sizes(self):
        def fake_list(secret, path, body):
            self.assertEqual(secret, "sb_secret_TEST_NONREAL")
            self.assertTrue(path.startswith("/storage/v1/object/list/"))
            if body["prefix"] == "":
                return [
                    {"name": "photos", "metadata": None, "id": None},
                    {"name": "root.jpg", "metadata": {"size": 4}, "id": "f1"},
                ]
            if body["prefix"] == "photos/":
                return [{"name": "nested.jpg", "metadata": {"size": 7}, "id": "f2"}]
            self.fail("Unexpected nested prefix")
        with mock.patch.object(storage, "remote_json", side_effect=fake_list):
            entries = storage.list_all_objects("sb_secret_TEST_NONREAL")
        self.assertEqual(entries, [("photos/nested.jpg", 7), ("root.jpg", 4)])

    def test_synthetic_backup_writes_hashes_and_removes_incomplete_data(self):
        files = {"p1.jpg": b"first", "nested/p2.jpg": b"second"}
        items = [("nested/p2.jpg", 6), ("p1.jpg", 5)]
        with tempfile.TemporaryDirectory() as d:
            with mock.patch.object(storage, "list_all_objects", return_value=items), \
                 mock.patch.object(storage, "download_object", side_effect=lambda token, path: files[path]):
                dest = storage.backup_storage(
                    "sb_secret_TEST_NONREAL", Path(d), expected_count=2, expected_bytes=11
                )
            self.assertEqual((dest / "files" / "p1.jpg").read_bytes(), files["p1.jpg"])
            manifest = json.loads((dest / "manifest-private.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["count"], 2)
            self.assertEqual(manifest["bytes"], 11)
            self.assertFalse(manifest["isolated_restore_verified"])
            self.assertEqual(
                next(item["sha256"] for item in manifest["objects"] if item["name"] == "p1.jpg"),
                hashlib.sha256(files["p1.jpg"]).hexdigest()
            )
            before = len(list(Path(d).iterdir()))
            with mock.patch.object(storage, "list_all_objects", return_value=items), \
                 mock.patch.object(storage, "download_object", side_effect=lambda token, path: files[path]):
                with self.assertRaises(storage.BackupBlocked):
                    storage.backup_storage(
                        "sb_secret_TEST_NONREAL", Path(d), expected_count=2, expected_bytes=12
                    )
            self.assertEqual(before, len(list(Path(d).iterdir())),
                             "Partial backup directory must be removed on failed size check")

    def test_network_request_uses_apikey_not_bearer(self):
        class DummyResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, length): return b"private-file-bytes"
        def mock_http(request, timeout):
            self.assertTrue(request.full_url.startswith(storage.BASE))
            self.assertIn("apikey", {name.lower() for name in (request.headers or {})})
            self.assertNotIn("authorization", {name.lower() for name in (request.headers or {})})
            self.assertEqual(request.get_method(), "GET")
            return DummyResponse()
        with mock.patch.object(storage, "urlopen", side_effect=mock_http):
            result = storage.download_object("sb_secret_TEST_NONREAL", "dir/name.jpg")
            self.assertEqual(result, b"private-file-bytes")


if __name__ == "__main__":
    unittest.main()
