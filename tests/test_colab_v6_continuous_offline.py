#!/usr/bin/env python3
"""Offline regression tests for V6.1 continuous, sequential Overture batches.

Never imports data, connects to Supabase, or downloads Overture files.
"""
import ast
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
CURRENT = ROOT / "notebooks/Januario_Leads_Fase_9_V6_1_Lotes_Continuos.ipynb"
PREVIOUS = ROOT / "notebooks/Januario_Leads_Fase_9_V6_Retomada_Priorizada_9h.ipynb"


def source(path, index):
    notebook = json.loads(path.read_text(encoding="utf-8"))
    assert notebook["nbformat"] == 4 and len(notebook["cells"]) == 4
    return "".join(notebook["cells"][index]["source"])


class TestContinuousBatches(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.setup = source(CURRENT, 2)
        cls.run = source(CURRENT, 3)
        cls.old_setup = source(PREVIOUS, 2)
        cls.old_run = source(PREVIOUS, 3)

    def test_syntax_and_continuation(self):
        ast.parse(self.setup)
        ast.parse(self.run)
        self.assertIn("optimized_groups(targets)", self.run)
        self.assertIn('paged_stage(secret,"overture_phase9_v5_attempts"', self.run)
        self.assertIn('paged_stage(secret,"overture_phase9_v5_gaps"', self.run)
        self.assertIn("dt.timedelta(minutes=12)", self.run)
        self.assertIn("recent_rate_limit(secret)", self.run)
        self.assertIn("safe_capacity(stats,1)", self.run)
        self.assertIn('getpass.getpass(', self.run)
        self.assertIn('confirm!="RETOMAR_V6"', self.run)

    def test_no_sleep_after_success_but_batch_remains_serial(self):
        self.assertIn("MIN_INTERVAL=90", self.old_setup)
        self.assertIn("MIN_INTERVAL=0", self.setup)
        self.assertNotIn("next_download_at", self.run)
        self.assertNotIn("time.sleep(delay)", self.run)
        self.assertNotIn("random.uniform(0,15)", self.run)
        self.assertNotIn("90s entre downloads", self.run)
        self.assertIn("subprocess.run(command,env=env,text=True,capture_output=True", self.run)
        self.assertNotIn("Popen(", self.run)
        self.assertNotIn("ThreadPoolExecutor", self.run)

    def test_error_and_storage_guards_remain_intact(self):
        for item in (
            "MAX_DOWNLOADS_PER_SESSION=320",
            "MAX_RUN_SECONDS=9*3600",
            "COOLDOWN_HOURS=8",
            "v5.MAX_NEW_PER_BATCH==40",
            "v5.MAX_CITIES_PER_BATCH==3",
            "v5.OVERTURE_MAX_MIB==340",
            "v5.DATABASE_MAX_MIB==440",
        ):
            self.assertIn(item, self.setup, item)
        for item in (
            "if stop_for_v5_error(code):",
            'print("PARADA GLOBAL:"',
            "v5.record_checkpoint(",
            "v5.current_stats(STAGING_URL,secret)",
            "v5.safe_capacity(stats,1)",
            "time.monotonic()>deadline-240",
        ):
            self.assertIn(item, self.run, item)
        self.assertNotIn("SUPABASE_PRODUCTION", self.run)

    def test_pinned_importer_sources(self):
        self.assertNotIn("januarioleads/main/scripts/", self.setup)
        self.assertNotIn("januarioleads/main/data/", self.setup)
        self.assertIn('STAGING_URL="https://prlrxjothrslhswpkoza.supabase.co"',self.setup)


if __name__ == "__main__":
    unittest.main()
