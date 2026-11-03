import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location(
    "release", Path(__file__).parents[2] / "scripts/verify-release-migration.py"
)
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_missing_token_sends_nothing(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(release, "urlopen") as send:
            with self.assertRaises(SystemExit):
                release.main()
            send.assert_not_called()

    def test_read_only_verification_passes_when_constraint_exists(self):
        def send(request, timeout):
            self.assertEqual(
                request.full_url,
                "https://api.supabase.com/v1/projects/czkazbianiflhldenhcj/database/query",
            )
            self.assertEqual(timeout, 30)
            query = json.loads(request.data)["query"]
            self.assertIn("pg_constraint", query)
            self.assertIn("presence_site", query)
            for forbidden in ("ALTER TABLE", "BEGIN;", "DROP CONSTRAINT", "CREATE TABLE"):
                self.assertNotIn(forbidden, query.upper() if forbidden.isupper() else query)
            return io.BytesIO(b'[{"applied":true}]')

        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "test-only"}):
            with patch.object(release, "urlopen", send):
                with patch("sys.stdout", new_callable=io.StringIO):
                    release.main()

    def test_missing_constraint_fails_closed(self):
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "test-only"}):
            with patch.object(release, "urlopen", return_value=io.BytesIO(b'[{"applied":false}]')):
                with self.assertRaises(SystemExit) as caught:
                    release.main()
        self.assertIn("Apply the reviewed migration", str(caught.exception))

    def test_failure_does_not_expose_response_or_token(self):
        error = HTTPError(
            "https://api.supabase.com", 400, "Bad Request", {},
            io.BytesIO(b'{"message":"secret-response"}'),
        )
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "test-only"}):
            with patch.object(release, "urlopen", side_effect=error):
                with self.assertRaises(SystemExit) as caught:
                    release.main()
        self.assertIn("400", str(caught.exception))
        self.assertNotIn("test-only", str(caught.exception))
        self.assertNotIn("secret-response", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
