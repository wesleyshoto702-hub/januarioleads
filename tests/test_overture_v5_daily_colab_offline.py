"""Offline guards for the reusable same-day 22h Fase 9 V5 Colab.

No network, cloud runtime or secret key is required to run this test.
"""
import contextlib
import datetime as dt
import io
import json
from pathlib import Path
import unittest
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
DAILY=ROOT/"notebooks/Januario_Leads_Fase_9_V5_Ate_22h_Cada_Dia.ipynb"
HISTORIC=ROOT/"notebooks/Januario_Leads_Fase_9_V5_Ate_22h_14nov2026.ipynb"


def notebook_sections(path):
    nb=json.loads(path.read_text(encoding="utf-8"))
    return nb,"".join(nb["cells"][2]["source"]),"".join(nb["cells"][3]["source"])


class ColabDailySessionOffline(unittest.TestCase):
    def test_setup_and_daily_schedule(self):
        nb,helper,runner=notebook_sections(DAILY)
        self.assertEqual(len(nb["cells"]),4)
        self.assertTrue(all(c.get("execution_count") is None and not c.get("outputs")
                            for c in nb["cells"] if c["cell_type"]=="code"))
        compile(helper,"daily_setup.py","exec")
        compile(runner,"daily_runner.py","exec")
        # The cutoff is determined anew on execution, not from a fixed 14-Nov date.
        self.assertIn("dt.datetime.now(FUSO_BRASILIA).date()",helper)
        self.assertIn("dt.datetime.now(FUSO_BRASILIA).date()",runner)
        self.assertIn('dt.time(hour=22)',runner)
        self.assertNotIn("dt.datetime(2026,11,14,22,0",runner)
        self.assertIn("MAX_DOWNLOADS_PER_SESSION=320",helper)
        self.assertIn("MIN_INTERVAL=90",helper)
        self.assertIn("COOLDOWN_HOURS=8",helper)
        self.assertIn("MAX_RUN_SECONDS=9*3600",helper)
        self.assertIn("v5.safe_capacity(stats,1)",runner)
        self.assertIn("recent_rate_limit(secret)",runner)
        self.assertIn('if confirm!="AMPLIAR_600K":',runner)
        self.assertIn('getpass.getpass',runner)
        self.assertNotIn("czkazbianiflhldenhcj",helper+runner)
        self.assertNotIn("GOOGLE_PLACES_API_KEY",runner)
        self.assertNotIn("GEOAPIFY_API_KEY",runner)

    def test_click_cell_3_without_cell_2_is_safe(self):
        _,_,runner=notebook_sections(DAILY)
        # Simulate clicking 'run' on cell 3 in a fresh kernel, as in reported error.
        namespace={"__name__":"__main__"}
        out=io.StringIO()
        with contextlib.redirect_stdout(out):
            exec(compile(runner,"standalone_cell3.py","exec"),namespace,namespace)
        self.assertIn("CONFIGURAÇÃO PENDENTE",out.getvalue())
        self.assertIn("Nenhuma importação foi iniciada",out.getvalue())
        self.assertIn("PARADA_LOCAL",namespace)
        self.assertNotIn("Chave SECRETA",out.getvalue())
        self.assertEqual(namespace["PARADA_LOCAL"].hour,22)
        self.assertEqual(namespace["PARADA_LOCAL"].minute,0)
        self.assertEqual(namespace["PARADA_LOCAL"].date(),
                         dt.datetime.now(ZoneInfo("America/Sao_Paulo")).date())

    def test_historic_still_expired_and_no_nameerror(self):
        nb,helper,runner=notebook_sections(HISTORIC)
        self.assertIn("PARADA_LOCAL=dt.datetime(2026,11,14,22,0",helper)
        self.assertIn("PARADA_LOCAL=dt.datetime(2026,11,14,22,0",runner)
        ns={}
        output=io.StringIO()
        with contextlib.redirect_stdout(output):
            exec(compile(runner,"historic_cell3.py","exec"),ns,ns)
        self.assertIn("CONFIGURAÇÃO PENDENTE",output.getvalue())
        self.assertIn("notebook diário atualizado",output.getvalue())
        self.assertIn("14/11/2026",nb["cells"][0]["source"][0])

    def test_safe_hour_and_storage_checks(self):
        _,_,runner=notebook_sections(DAILY)
        ns={}
        output=io.StringIO()
        with contextlib.redirect_stdout(output):
            exec(compile(runner,"daily_cell3.py","exec"),ns,ns)
        self.assertTrue(ns["PARADA_LOCAL"].isoformat().endswith("-03:00"))
        self.assertLessEqual(ns["faltam_segundos_ate_parada"](),22*3600)
        self.assertIn("if faltam_segundos_ate_parada() <= MARGEM_PARADA_SEGUNDOS+300:",runner)
        self.assertIn("max(0,faltam_segundos_ate_parada()-MARGEM_PARADA_SEGUNDOS)",runner)
        self.assertIn("time.monotonic()>deadline-240",runner)
        self.assertIn("timeout=min(1500",runner)
        self.assertIn("except KeyboardInterrupt:",runner)
        self.assertIn('secret=""',runner)
        self.assertIn("resolution=ignore-duplicates",(
            ROOT/"scripts/expand_overture_600k_staging.py").read_text(encoding="utf-8"))


if __name__=="__main__":
    unittest.main()
