"""Offline safety checks for the one-day, long-running V5 Colab notebook.

No Colab execution, Overture download, Supabase credentials or network required.
"""
import datetime as dt
import json
import pathlib
import types
import unittest
from zoneinfo import ZoneInfo

ROOT=pathlib.Path(__file__).resolve().parents[1]
PATH=ROOT/"notebooks/Januario_Leads_Fase_9_V5_Ate_22h_14nov2026.ipynb"


def load():
    nb=json.loads(PATH.read_text(encoding="utf-8"))
    return nb, "".join(nb["cells"][2]["source"]), "".join(nb["cells"][3]["source"])


class TimeLimitedUnattendedV5(unittest.TestCase):
    def test_3_step_manual_staging_and_no_auto_start_on_open(self):
        nb, setup, runner=load()
        self.assertEqual(len(nb["cells"]),4)
        for cell in nb["cells"]:
            if cell["cell_type"]=="code":
                self.assertIsNone(cell["execution_count"])
                self.assertEqual(cell["outputs"],[])
        self.assertIn('STAGING_URL="https://prlrxjothrslhswpkoza.supabase.co"',setup)
        self.assertIn("AMPLIAR_600K",runner)
        self.assertIn("getpass.getpass",runner)
        self.assertIn('if confirm!="AMPLIAR_600K"',runner)
        self.assertIn("v5.current_stats(STAGING_URL,secret)",runner)
        self.assertNotIn("czkazbianiflhldenhcj",setup+runner)
        self.assertNotIn("GOOGLE_PLACES_API_KEY",runner)
        self.assertNotIn("GEOAPIFY_API_KEY",runner)

    def test_cutoff_exact_day_and_clock(self):
        _,setup,runner=load()
        frag=setup[setup.index("# Sessão longa de 14/11/2026:"):
                   setup.index("assert MIN_INTERVAL>=75 and COOLDOWN_HOURS>=6")]
        ns={"dt":dt}
        exec(compile(frag,"time_limit_test.py","exec"),ns,ns)
        self.assertEqual(ns["PARADA_LOCAL"].isoformat(),"2026-11-14T22:00:00-03:00")
        self.assertEqual(str(ns["FUSO_BRASILIA"]),"America/Sao_Paulo")
        self.assertGreaterEqual(ns["MIN_INTERVAL"],90)
        self.assertEqual(ns["COOLDOWN_HOURS"],8)
        self.assertEqual(ns["MAX_DOWNLOADS_PER_SESSION"],320)
        self.assertLessEqual(ns["MAX_RUN_SECONDS"],9*3600)
        self.assertGreater(ns["MARGEM_PARADA_SEGUNDOS"],0)
        cutoff=ns["PARADA_LOCAL"]
        class FakeClock:
            clock=cutoff-dt.timedelta(minutes=5)
            @classmethod
            def now(cls,tz):
                return cls.clock.astimezone(tz)
        ns["dt"]=types.SimpleNamespace(datetime=FakeClock)
        self.assertAlmostEqual(ns["faltam_segundos_ate_parada"](),300)
        FakeClock.clock=cutoff+dt.timedelta(seconds=1)
        self.assertLess(ns["faltam_segundos_ate_parada"](),0)
        self.assertIn("if faltam_segundos_ate_parada() <= MARGEM_PARADA_SEGUNDOS+300:",runner)
        self.assertIn("max(0,faltam_segundos_ate_parada()-MARGEM_PARADA_SEGUNDOS)",runner)

    def test_limits_resume_interrupt_and_masked_keys(self):
        _,setup,runner=load()
        compile(setup,"session_setup.py","exec")
        compile(runner,"session_runner.py","exec")
        self.assertIn("recent_rate_limit(secret)",runner)
        self.assertIn("if last and now<last+dt.timedelta(hours=COOLDOWN_HOURS)",runner)
        self.assertIn("v5.safe_capacity(stats,1)",runner)
        self.assertIn("v5.record_checkpoint",runner)
        self.assertIn("code==\"batch_largura\" and len(group)>1",runner)
        self.assertIn("next_download_at=time.monotonic()+MIN_INTERVAL",runner)
        self.assertIn("timeout=min(1500",runner)
        self.assertIn("except KeyboardInterrupt:",runner)
        self.assertIn('secret=""',runner)
        self.assertIn("groups=collections.deque(close_groups(targets))",runner)
        self.assertIn('MAX_DOWNLOADS_PER_SESSION=320',setup)


if __name__=="__main__":
    unittest.main()
