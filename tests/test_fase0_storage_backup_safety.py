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
        self.assertIn('"Authorization": f"Bearer {secret}"', src)
        self.assertIn('"apikey": secret', src)
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

    def test_http400_diagnostics_never_show_credentials_or_raw_api_payload(self):
        import io
        from urllib.error import HTTPError
        token = "sb_secret_SUPER_PRIVATE_NEVER_ECHO"
        cases = [
            ({"code": "InvalidRequest", "message": f"bad request {token}"}, "estrutura"),
            ({"error": "Bad Request", "message": f"Missing Authorization header. {token}"}, "Authorization"),
            ({"code": "InvalidJWT", "message": f"Invalid JWT {token}"}, "JWT"),
            ({"message": f"Some unknown error {token} object/secret.png"}, "nao classificado"),
            ({"code": "InvalidKey", "message": f"Invalid Key {token}"}, "API key"),
        ]
        for body, expected in cases:
            with self.subTest(expected=expected):
                err = HTTPError("https://test.invalid", 400, "bad", None,
                                io.BytesIO(json.dumps(body).encode("utf-8")))
                text = str(storage.safe_http_error(err, action="Listagem Storage recusada"))
                self.assertIn("HTTP 400", text)
                self.assertIn(expected, text)
                self.assertNotIn(token, text)
                self.assertNotIn("secret.png", text)

    def test_list_uses_correct_auth_headers_and_does_not_echo_key(self):
        from unittest.mock import Mock
        key = "sb_secret_SYNTHETIC_KEY_NOT_FOR_USE"
        class DummyResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, length): return b"[]"
        def fake_urlopen(req, timeout):
            self.assertEqual(req.get_method(), "POST")
            headers = {name.lower(): value for name, value in req.headers.items()}
            self.assertEqual(headers["apikey"], key)
            self.assertEqual(headers["authorization"], "Bearer " + key)
            self.assertNotIn(key, req.full_url)
            self.assertTrue(req.full_url.startswith(storage.BASE + "/storage/v1/"))
            return DummyResponse()
        with mock.patch.object(storage, "urlopen", side_effect=fake_urlopen):
            result = storage.remote_json(
                key, "/storage/v1/object/list/" + storage.BUCKET,
                {"prefix": "", "limit": 100, "offset": 0}
            )
        self.assertEqual(result, [])

    def test_diagnosis_mode_does_not_download_or_log_private_object_names(self):
        import io
        import contextlib
        import sys
        key = "sb_secret_THIS_IS_A_SYNTHETIC_KEY_DO_NOT_USE"
        with tempfile.TemporaryDirectory() as d, \
             mock.patch.object(storage.getpass, "getpass", return_value=key), \
             mock.patch.object(storage, "list_all_objects",
                               return_value=[("private/path/client.jpg", 500)]), \
             mock.patch.object(storage, "backup_storage",
                               side_effect=AssertionError("diagnose should not download")), \
             mock.patch.object(sys, "argv",
                               ["test-script", "--diagnose", "--directory", d,
                                "--confirm-encrypted-volume"]), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            result = storage.main()
        self.assertEqual(result, 0)
        log = output.getvalue()
        self.assertIn("objetos encontrados: 1", log)
        self.assertNotIn("client.jpg", log)
        self.assertNotIn(key, log)

    def test_storage_requests_use_apikey_and_bearer_fallback_like_official_sdk(self):
        class DummyResponse:
            def __enter__(self): return self
            def __exit__(self, *args): return False
            def read(self, length): return b"private-file-bytes"
        def mock_http(request, timeout):
            self.assertTrue(request.full_url.startswith(storage.BASE))
            self.assertIn("apikey", {name.lower() for name in (request.headers or {})})
                        headers = {name.lower(): value for name, value in (request.headers or {}).items()}
            self.assertEqual(headers["authorization"], "Bearer sb_secret_TEST_NONREAL")
            self.assertEqual(headers["apikey"], "sb_secret_TEST_NONREAL")
            self.assertEqual(request.get_method(), "GET")
            return DummyResponse()
        with mock.patch.object(storage, "urlopen", side_effect=mock_http):
            result = storage.download_object("sb_secret_TEST_NONREAL", "dir/name.jpg")
            self.assertEqual(result, b"private-file-bytes")


if __name__ == "__main__":
    unittest.main()
