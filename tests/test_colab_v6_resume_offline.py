#!/usr/bin/env python3
"""Offline safety and continuation checks for Fase 9 V6 notebook.
No external calls, downloads, credentials or Supabase writes.
"""
import ast
import collections
import json
from pathlib import Path
import re
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]
NB = ROOT / "notebooks/Januario_Leads_Fase_9_V6_Retomada_Priorizada_9h.ipynb"
V5 = ROOT / "notebooks/Januario_Leads_Fase_9_V5_Sessao_Livre_9h.ipynb"


class TestSafeResumeNotebook(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nb = json.loads(NB.read_text(encoding="utf-8"))
        cls.v5 = json.loads(V5.read_text(encoding="utf-8"))
        cls.cells = ["".join(c["source"]) for c in cls.nb["cells"]]
        cls.before = ["".join(c["source"]) for c in cls.v5["cells"]]

    def test_parse_python_cells_and_notebook(self):
        self.assertEqual(self.nb["nbformat"], 4)
        self.assertEqual(len(self.cells), 4)
        for index in (2, 3):
            ast.parse(self.cells[index])
        self.assertEqual(self.nb["cells"][3]["outputs"], [])
        self.assertIsNone(self.nb["cells"][3]["execution_count"])

    def test_original_quotas_unchanged_and_no_paid_sources(self):
        before = self.before[2]
        after = self.cells[2]
        for exact in ("MIN_INTERVAL=90", "COOLDOWN_HOURS=8",
                      "MAX_DOWNLOADS_PER_SESSION=320", "MAX_RUN_SECONDS=9*3600",
                      "v5.MAX_NEW_PER_BATCH==40", "v5.MAX_CITIES_PER_BATCH==3",
                      "v5.OVERTURE_MAX_MIB==340", "v5.DATABASE_MAX_MIB==440"):
            self.assertIn(exact, before)
            self.assertIn(exact, after)
        self.assertIn("STAGING_URL=\"https://prlrxjothrslhswpkoza.supabase.co\"", after)
        self.assertNotIn("SUPABASE_PRODUCTION", after)
        self.assertNotIn("https://maps.googleapis.com", after)
        self.assertNotIn("https://api.geoapify.com", after)

    def test_source_code_frozen_to_immutable_commit(self):
        setup = self.cells[2]
        self.assertNotIn("januarioleads/main/scripts/", setup)
        self.assertNotIn("januarioleads/main/data/", setup)
        match = re.search(r'BASE="https://raw.githubusercontent.com/[^"]+/([a-f0-9]{40})/scripts/"', setup)
        self.assertIsNotNone(match)
        self.assertIn(match.group(1) + "/data/populacao-municipal-2022-referencia.json", setup)

    def test_resume_protections_keep_v5_storage_and_checkpoint(self):
        run = self.cells[3]
        for required in ("recent_rate_limit(secret)", "current_stats(STAGING_URL,secret)",
                         'paged_stage(secret,"overture_phase9_v5_gaps"',
                         'paged_stage(secret,"overture_phase9_v5_attempts"',
                         '"no_more"', "timedelta(days=14)",
                         'confirm!="RETOMAR_V6"', "getpass.getpass(",
                         'dt.timedelta(minutes=12)', 'optimized_groups(targets)',
                         '"--plans-json"', "safe_capacity(stats,1)"):
            self.assertIn(required, run, required)
        self.assertNotIn('confirm!="AMPLIAR_600K"', run)

    def test_group_priority_and_fairness_using_only_fake_data(self):
        setup = ast.parse(self.cells[2])
        function = next(n for n in setup.body
                        if isinstance(n, ast.FunctionDef) and n.name == "optimized_groups")
        ns = {
            "collections": collections,
            "v5": types.SimpleNamespace(MAX_NEW_PER_BATCH=40),
            "close_groups": lambda rows: [
                [rows[0]], [rows[1], rows[2], rows[3]],
                [rows[4]], [rows[5], rows[6]],
            ]
        }
        exec(compile(ast.Module(body=[function], type_ignores=[]), "<offline>", "exec"), ns)
        def city(uf, city, remaining):
            return {"state": uf, "city_key": city, "city": city,
                    "plan": {"tier": "medium", "target": 240},
                    "imported_rows": 240 - remaining,
                    **{k:0 for k in ("barbers","food","fitness","beauty",
                                     "health","auto_services","lodging","retail")}}
        rows = [city("MG","a",35),city("MG","b",120),city("MG","c",90),
                city("MG","d",80),city("SP","e",40),city("SP","f",40),
                city("SP","g",40)]
        groups = ns["optimized_groups"](rows)
        self.assertEqual(sum(map(len,groups)),len(rows))
        self.assertEqual(groups[0][0]["city_key"],"b") # 3-city batch preferred
        self.assertEqual(groups[1][0]["state"],"SP") # State fairness
        self.assertEqual(set(g[0]["state"] for g in groups),{"MG","SP"})
        self.assertTrue(all(1<=len(g)<=3 for g in groups))
        self.assertTrue(all(len({r["state"] for r in g})==1 for g in groups))


if __name__ == "__main__":
    unittest.main()
