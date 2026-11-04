import importlib.util
import os
from pathlib import Path
import unittest

path = Path(__file__).parents[2] / "scripts/test-staging-rls.py"
spec = importlib.util.spec_from_file_location("staging_rls", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class StagingConfigTests(unittest.TestCase):
    def setUp(self):
        self.good = {
            "JANUARIO_STAGING_SUPABASE_URL": "https://test-staging.supabase.co",
            "JANUARIO_STAGING_SUPABASE_KEY": "fake-public-key",
            "JANUARIO_STAGING_A_EMAIL": "a@example.invalid",
            "JANUARIO_STAGING_A_PASSWORD": "fake-pass-a",
            "JANUARIO_STAGING_B_EMAIL": "b@example.invalid",
            "JANUARIO_STAGING_B_PASSWORD": "fake-pass-b",
        }

    def test_valid_staging_config(self):
        self.assertEqual(mod.staging_config(self.good)[0], "https://test-staging.supabase.co")

    def test_production_is_always_rejected(self):
        data = {**self.good, "JANUARIO_STAGING_SUPABASE_URL": "https://czkazbianiflhldenhcj.supabase.co"}
        with self.assertRaisesRegex(RuntimeError, "production forbidden"):
            mod.staging_config(data)

    def test_untrusted_url_rejected(self):
        for url in [
            "http://test-staging.supabase.co",
            "https://test-staging.supabase.co@czkazbianiflhldenhcj.supabase.co",
            "https://test-staging.supabase.co/path",
            "https://test-staging.supabase.co?redirect=1",
        ]:
            with self.assertRaises(RuntimeError):
                mod.staging_config({**self.good, "JANUARIO_STAGING_SUPABASE_URL": url})

    def test_missing_credentials_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "missing"):
            mod.staging_config({})

    def test_two_accounts_required(self):
        data = {**self.good, "JANUARIO_STAGING_B_EMAIL": "A@example.invalid"}
        with self.assertRaisesRegex(RuntimeError, "distinct"):
            mod.staging_config(data)

    def test_no_network_without_staging_credentials(self):
        with self.assertRaisesRegex(RuntimeError, "not configured"):
            mod.exercise_staging_rls({})


if __name__=="__main__":
    unittest.main()
