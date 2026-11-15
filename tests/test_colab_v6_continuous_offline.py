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
        cls.execution_source = source(CURRENT, 3)
        cls.old_setup = source(PREVIOUS, 2)
        cls.previous_execution_source = source(PREVIOUS, 3)

    def test_syntax_and_continuation(self):
        ast.parse(self.setup)
        ast.parse(self.execution_source)
        self.assertIn("optimized_groups(targets)", self.execution_source)
        self.assertIn('paged_stage(secret,"overture_phase9_v5_attempts"', self.execution_source)
        self.assertIn('paged_stage(secret,"overture_phase9_v5_gaps"', self.execution_source)
        self.assertIn("dt.timedelta(minutes=12)", self.execution_source)
        self.assertIn("recent_rate_limit(secret)", self.execution_source)
        self.assertIn("safe_capacity(stats,1)", self.execution_source)
        self.assertIn('getpass.getpass(', self.execution_source)
        self.assertIn('confirm!="RETOMAR_V6"', self.execution_source)

    def test_no_sleep_after_success_but_batch_remains_serial(self):
        self.assertIn("MIN_INTERVAL=90", self.old_setup)
        self.assertIn("MIN_INTERVAL=0", self.setup)
        self.assertNotIn("next_download_at", self.execution_source)
        self.assertNotIn("time.sleep(delay)", self.execution_source)
        self.assertNotIn("random.uniform(0,15)", self.execution_source)
        self.assertNotIn("90s entre downloads", self.execution_source)
        self.assertIn("subprocess.run(command,env=env,text=True,capture_output=True", self.execution_source)
        self.assertNotIn("Popen(", self.execution_source)
        self.assertNotIn("ThreadPoolExecutor", self.execution_source)

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
            self.assertIn(item, self.execution_source, item)
        self.assertNotIn("SUPABASE_PRODUCTION", self.execution_source)

    def test_pinned_importer_sources(self):
        self.assertNotIn("januarioleads/main/scripts/", self.setup)
        self.assertNotIn("januarioleads/main/data/", self.setup)
        self.assertIn('STAGING_URL="https://prlrxjothrslhswpkoza.supabase.co"',self.setup)


if __name__ == "__main__":
    unittest.main()
