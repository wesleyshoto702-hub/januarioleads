import importlib.util
import unittest
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError

path = Path(__file__).parents[2] / "scripts/verify-edge-function-cors.py"
spec = importlib.util.spec_from_file_location("cors_check", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FakeResponse:
    def __init__(self, code, headers):
        self.status = code
        self.headers = Message()
        for key, value in headers.items():
            self.headers[key] = value

    def __enter__(self): return self
    def __exit__(self, *_): return False


class CORSSmokeTests(unittest.TestCase):
    def test_approved_origin(self):
        def opener(req, timeout):
            self.assertEqual(req.get_method(), "OPTIONS")
            self.assertIn("/functions/v1/search-places", req.full_url)
            self.assertEqual(timeout, 15)
            origin = req.get_header("Origin")
            return FakeResponse(204, {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Vary": "Origin",
            })
        self.assertTrue(mod.check_preflight("search-places", "https://januleads.vercel.app", opener=opener))

    def test_missing_cors_header_is_failure(self):
        with self.assertRaisesRegex(RuntimeError, "Preflight failed"):
            mod.check_preflight("search-places", "https://januleads.vercel.app",
                opener=lambda *_a, **_k: FakeResponse(204, {}))

    def test_403_for_untrusted_origin_is_expected(self):
        def opener(req, timeout):
            raise HTTPError(req.full_url, 403, "Forbidden", {}, None)
        self.assertTrue(mod.check_preflight("search-places", "https://attacker.example",
            should_allow=False, opener=opener))

    def test_unexpected_open_origin_fails(self):
        with self.assertRaisesRegex(RuntimeError, "Untrusted browser origin accepted"):
            mod.check_preflight("search-places", "https://attacker.example",
                should_allow=False, opener=lambda *_a, **_k: FakeResponse(204, {
                    "Access-Control-Allow-Origin": "https://attacker.example"
                }))


if __name__ == "__main__":
    unittest.main()
