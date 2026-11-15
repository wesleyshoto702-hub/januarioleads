"""Testes offline da sessão V5 livre de 9 horas (sem limite às 22h).

Nenhuma importação, conexão, credencial ou chamada externa nestes testes.
"""
import contextlib
import datetime as dt
import io
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = ROOT / "notebooks/Januario_Leads_Fase_9_V5_Sessao_Livre_9h.ipynb"

class V5LongSessionWithoutFixedTime(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
        cls.helper = "".join(cls.nb["cells"][2]["source"])
        cls.runner = "".join(cls.nb["cells"][3]["source"])

    def test_notebook_is_unexecuted_and_manual(self):
        self.assertEqual(len(self.nb["cells"]), 4)
        for cell in self.nb["cells"]:
            if cell["cell_type"] == "code":
                self.assertIsNone(cell["execution_count"])
                self.assertEqual(cell["outputs"], [])
        compile(self.helper, "session_helper.py", "exec")
        compile(self.runner, "session_runner.py", "exec")
        self.assertIn("AMPLIAR_600K", self.runner)
        self.assertIn("getpass.getpass", self.runner)
        self.assertIn("if confirm!=\"AMPLIAR_600K\":", self.runner)
        self.assertIn("CONFIGURAÇÃO PENDENTE", self.runner)

    def test_no_2200_cutoff_and_relative_9h(self):
        self.assertIn("MAX_RUN_SECONDS=9*3600", self.helper)
        self.assertIn("MAX_DOWNLOADS_PER_SESSION=320", self.helper)
        self.assertIn("MIN_INTERVAL=90", self.helper)
        self.assertIn("COOLDOWN_HOURS=8", self.helper)
        self.assertIn("deadline=time.monotonic()+MAX_RUN_SECONDS", self.runner)
        self.assertIn("time.monotonic()>deadline-240", self.runner)
        self.assertIn("timeout=min(1500", self.runner)
        self.assertNotIn("PARADA_LOCAL", self.runner + self.helper)
        self.assertNotIn("FUSO_BRASILIA", self.runner + self.helper)
        self.assertNotIn("faltam_segundos_ate_parada", self.runner + self.helper)
        self.assertNotIn("dt.time(hour=22)", self.runner + self.helper)

    def test_missing_setup_does_not_prompt_or_import(self):
        values = {"__name__": "__main__"}
        stdout = io.StringIO()
        with contextlib.redirect_stdout(stdout):
            exec(compile(self.runner, "cell3.py", "exec"), values, values)
        msg = stdout.getvalue()
        self.assertIn("CONFIGURAÇÃO PENDENTE", msg)
        self.assertIn("Nenhuma importação foi iniciada", msg)
        self.assertNotIn("Chave SECRETA", msg)

    def test_guards_cooldown_and_staging_only(self):
        self.assertIn("recent_rate_limit(secret)", self.runner)
        self.assertIn("v5.safe_capacity(stats,1)", self.runner)
        self.assertIn("v5.record_checkpoint", self.runner)
        self.assertIn("next_download_at=time.monotonic()+MIN_INTERVAL", self.runner)
        self.assertIn("except KeyboardInterrupt:", self.runner)
        self.assertIn('secret=""', self.runner)
        self.assertIn("prlrxjothrslhswpkoza", self.helper)
        self.assertNotIn("czkazbianiflhldenhcj", self.helper + self.runner)
        self.assertNotIn("GOOGLE_PLACES_API_KEY", self.runner)
        self.assertNotIn("GEOAPIFY_API_KEY", self.runner)
        importer = (ROOT / "scripts/expand_overture_600k_staging.py").read_text(encoding="utf-8")
        self.assertIn("resolution=ignore-duplicates,return=minimal", importer)
        self.assertIn("STAGING_URL", importer)

if __name__=="__main__":
    unittest.main()
