import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

spec = importlib.util.spec_from_file_location(
    "security_preflight", Path(__file__).parents[2] / "scripts/verify-production-security.py"
)
security_preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(security_preflight)


class ProductionSecurityTests(unittest.TestCase):
    def test_missing_token_never_sends_request(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(security_preflight, "urlopen") as send:
            with self.assertRaises(SystemExit):
                security_preflight.check_security()
            send.assert_not_called()

    def test_read_only_query_and_success(self):
        def respond(request, timeout):
            self.assertEqual(timeout, 30)
            self.assertEqual(request.get_method(), "POST")
            self.assertIn("/database/query", request.full_url)
            query = json.loads(request.data)["query"]
            self.assertIn("pg_class", query)
            self.assertIn("pg_proc", query)
            self.assertIn("relrowsecurity", query)
            self.assertIn("has_function_privilege", query)
            self.assertTrue(query.strip().upper().startswith("SELECT"))
            self.assertNotIn("ALTER TABLE", query.upper())
            self.assertNotIn("DROP TABLE", query.upper())
            return io.BytesIO(b'[{"all_public_tables_rls":true,"privileged_rpcs_private":true}]')

        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "fake-test-token"}):
            with patch.object(security_preflight, "urlopen", side_effect=respond):
                with patch("sys.stdout", new_callable=io.StringIO):
                    security_preflight.check_security()

    def test_missing_rls_fails(self):
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "fake-test-token"}):
            with patch.object(security_preflight, "urlopen", return_value=io.BytesIO(b'[{"all_public_tables_rls":false,"privileged_rpcs_private":true}]')):
                with self.assertRaises(SystemExit) as caught:
                    security_preflight.check_security()
        self.assertIn("lacks RLS", str(caught.exception))

    def test_privileged_rpc_exposure_fails(self):
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "fake-test-token"}):
            with patch.object(security_preflight, "urlopen", return_value=io.BytesIO(b'[{"all_public_tables_rls":true,"privileged_rpcs_private":false}]')):
                with self.assertRaises(SystemExit) as caught:
                    security_preflight.check_security()
        self.assertIn("SECURITY DEFINER", str(caught.exception))

    def test_http_error_does_not_leak_response_or_token(self):
        error = HTTPError("https://api.supabase.com", 403, "Forbidden", {}, io.BytesIO(b'{"message":"do-not-show"}'))
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "fake-test-token"}):
            with patch.object(security_preflight, "urlopen", side_effect=error):
                with self.assertRaises(SystemExit) as caught:
                    security_preflight.check_security()
        self.assertIn("403", str(caught.exception))
        self.assertNotIn("fake-test-token", str(caught.exception))
        self.assertNotIn("do-not-show", str(caught.exception))

    def test_invalid_response_fails_closed(self):
        with patch.dict(os.environ, {"SUPABASE_ACCESS_TOKEN": "fake-test-token"}):
            with patch.object(security_preflight, "urlopen", return_value=io.BytesIO(b'[{"all_public_tables_rls":true}]')):
                with self.assertRaises(SystemExit):
                    security_preflight.check_security()


if __name__ == "__main__":
    unittest.main()
