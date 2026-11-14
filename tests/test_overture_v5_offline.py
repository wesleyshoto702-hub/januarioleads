"""Offline regression tests — no network, credentials or Overture downloads."""
import ast
import io
import json
import pathlib
import re
import sys
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
import expand_overture_600k_staging as v5
import expand_overture_to_100_staging as v4

def row(identifier,category="restaurant",latitude=-21.,phone="+5535999999999",name=None):
    name=name or f"Company {identifier}"
    return {"id":str(identifier),"name":name,
        "name_key":v4.normalize(name),"latitude":latitude,
        "longitude":-45.0,"category":category,"phone":phone,
        "email":None,"website":None,"instagram":None,"confidence":0.8}

class V5SafeAndBalanced(unittest.TestCase):
    def test_limits(self):
        self.assertEqual((v5.GOAL_COMPANIES,v5.OVERTURE_MAX_MIB,
                          v5.DATABASE_MAX_MIB),(600000,340,440))
        self.assertEqual(v5.MAX_NEW_PER_BATCH,40)
        self.assertEqual(v5.MAX_CITIES_PER_BATCH,3)
        base={"total_companies":291515,"useful_companies":234417,
              "overture_bytes":151*v5.MIB,"database_bytes":165*v5.MIB}
        self.assertEqual(v5.safe_capacity(base,40),40)
        self.assertEqual(v5.safe_capacity(dict(base,useful_companies=599997),40),3)
        self.assertEqual(v5.safe_capacity(dict(base,useful_companies=600000),40),0)
        self.assertEqual(v5.safe_capacity(dict(base,total_companies=700000,useful_companies=599999),40),1)
        self.assertEqual(v5.safe_capacity(dict(base,overture_bytes=340*v5.MIB),40),0)
        self.assertEqual(v5.safe_capacity(dict(base,database_bytes=440*v5.MIB),40),0)
        self.assertEqual(v5.safe_capacity(dict(base,overture_bytes=340*v5.MIB-1024),40),1)
        self.assertEqual(v5.safe_capacity(dict(base,database_bytes=440*v5.MIB-512),40),0)

    def test_only_real_contact_businesses(self):
        self.assertTrue(v5.useful(row("b","barber")))
        self.assertFalse(v5.useful(row("park","park")))
        self.assertFalse(v5.useful(row("no","restaurant",phone=None)))
        self.assertFalse(v5.useful(row("none",category="river",phone=None)))
        self.assertFalse(v5.useful(row("plain","")))
        social=row("social","bakery",phone=None)
        social["instagram"]="https://instagram.com/company"
        self.assertTrue(v5.useful(social))

    def test_duplicate_ids_and_nearby_alias(self):
        originals=[row("1","restaurant",latitude=-21.,name="Company 1")]
        options=[row("1","barber"),row("2","barber",latitude=-21.00001,name="Company 1"),
                 row("3","barber",latitude=-21.01,name="Company 1")]
        results=v5.pick_balanced(options,originals,4)
        self.assertEqual([x["id"] for x in results],["3"])

    def test_rebalance_niches(self):
        old=[row("old"+str(i),"restaurant",latitude=-21.+i*.001)
             for i in range(30)]
        # Many candidate restaurants, one underrepresented barber
        options=[row("r"+str(i),"restaurant",latitude=-20+i*.001)
                 for i in range(20)]+[row("b","barber",latitude=-19)]
        result=v5.pick_balanced(options,old,5)
        self.assertEqual(result[0]["id"],"b")
        self.assertEqual(len(result),5)

    def test_city_population_tier_caps(self):
        plans={"lavras":{"tier":"medium","target":240,"population":100000},
               "sao paulo":{"tier":"metro","target":2400,"population":11000000}}
        self.assertEqual(v5.validate_plans(plans,["lavras","sao paulo"]),plans)
        with self.assertRaises(ValueError):
            v5.validate_plans({"lavras":{"tier":"small","target":500}},["lavras"])
        with self.assertRaises(ValueError):
            v5.validate_plans(plans,["lavras"])
        self.assertEqual(v5.CITY_CAPS["small"],100)

    def test_existing_city_reads_beyond_old_100(self):
        pages=[[row(i) for i in range(1000)],
               [row(i) for i in range(1000,1500)]]
        with patch.object(v4,"api",side_effect=pages) as api:
            rows=v5.existing_city(v5.STAGING_URL,"fake","MG","lavras",2400)
        self.assertEqual(len(rows),1500)
        self.assertEqual(api.call_count,2)

    def test_phase9_v4_preserved_independently(self):
        self.assertEqual(v4.TARGET_PER_MUNICIPALITY,100)
        self.assertEqual(v4.MAX_NEW_PER_MUNICIPALITY,40)
        self.assertNotIn("original_phase9_count",open(
            ROOT/"scripts/expand_overture_600k_staging.py",encoding="utf8").read())

    def test_population_reference_does_not_call_ibge_and_fails_closed(self):
        snap=ROOT/"data/populacao-municipal-2022-referencia.json"
        doc=json.loads(snap.read_text(encoding="utf-8"))
        self.assertEqual(doc["metadata"]["reference_year"],2022)
        self.assertGreaterEqual(len(doc["populations"]),5500)
        self.assertGreater(doc["populations"]["SP|sao paulo"],700000)
        self.assertGreater(doc["populations"]["MG|lavras"],30000)
        nb=json.loads((ROOT/"notebooks/Januario_Leads_Fase_9_V5_600_Mil_Empresas.ipynb").read_text())
        helper="".join(nb["cells"][2]["source"])
        part=helper[helper.index("POP_SNAPSHOT_URL="):helper.index("def plan_for_city(row):")]
        # Simulate the reported timeout twice: no traceback, no keys and no import.
        namespace={"urllib":urllib,"json":json,"re":re}
        with patch("urllib.request.urlopen",side_effect=urllib.error.URLError("timed out")) as mocked:
            exec(compile(part,"snapshot_fallback_test.py","exec"),namespace,namespace)
        self.assertEqual(mocked.call_count,2)
        self.assertEqual(namespace["POPULATIONS"],{})
        # When GitHub responds, the complete local snapshot works, no IBGE call.
        class FakeResponse(io.BytesIO):
            pass
        namespace={"urllib":urllib,"json":json,"re":re}
        with patch("urllib.request.urlopen",side_effect=lambda *a,**kw: FakeResponse(snap.read_bytes())) as mocked:
            exec(compile(part,"snapshot_ok_test.py","exec"),namespace,namespace)
        self.assertEqual(mocked.call_count,1)
        self.assertGreaterEqual(len(namespace["POPULATIONS"]),5500)
        self.assertGreater(namespace["POPULATIONS"][("SP","sao paulo")],700000)

    def test_v5_sanitized_error_classification_in_colab(self):
        nb=json.loads((ROOT/"notebooks/Januario_Leads_Fase_9_V5_600_Mil_Empresas.ipynb").read_text())
        helper="".join(nb["cells"][2]["source"])
        runner="".join(nb["cells"][3]["source"])
        diagnostic=helper[helper.index("V5_KNOWN_ERRORS="):helper.index("def recent_rate_limit(secret):")]
        namespace={"re":re}
        exec(compile(diagnostic,"diagnostic.py","exec"),namespace,namespace)
        classify=namespace["classify_v5_error"]
        self.assertEqual(classify(
            "Traceback AttributeError: module v4 has no attribute classify_import_error",1),
            "erro_codigo")
        self.assertEqual(classify(
            "V5_ERROR_STAGE=source_download\\nV5_ERROR_CLASS=fonte_download\\nHTTP Error 429 Too Many Requests",1),
            "fonte_taxa")
        self.assertEqual(classify(
            "V5_ERROR_STAGE=municipal_boundaries\\nV5_ERROR_CLASS=malha_ibge\\nHTTP Error 429",1),
            "malha_ibge")
        self.assertEqual(classify("BATCH_TOO_WIDE polygons",1),"batch_largura")
        self.assertEqual(classify("V5_ERROR_STAGE=source_download\\nV5_ERROR_CLASS=fonte_download",1),
                         "fonte_download")
        self.assertTrue(namespace["stop_for_v5_error"]("fonte_taxa"))
        self.assertTrue(namespace["stop_for_v5_error"]("fonte_download"))
        self.assertFalse(namespace["stop_for_v5_error"]("rede_timeout"))
        self.assertNotIn("v4.classify_import_error",runner)
        self.assertIn("groups=collections.deque(close_groups(targets))",runner)
        self.assertIn("groups.appendleft([city])",runner)
        self.assertIn('code=="batch_largura" and len(group)>1',runner)
        self.assertIn('V5_ERROR_STAGE=([a-z_]{1,40})',runner)

    def test_importer_reports_safe_failure_stage_not_original_exception(self):
        previous=v5.IMPORT_STAGE
        try:
            v5.import_stage("source_download")
            self.assertEqual(v5.safe_error_kind(AttributeError("secret_abc")),"erro_codigo")
            self.assertEqual(v5.safe_error_kind(
                __import__("subprocess").CalledProcessError(1,["overturemaps"])),
                "fonte_download")
            v5.import_stage("municipal_boundaries")
            self.assertEqual(v5.safe_error_kind(TimeoutError("timed out")),"malha_ibge")
        finally:
            v5.import_stage(previous)

    def test_colab_is_manual_and_staging_only(self):
        filename=ROOT/"notebooks/Januario_Leads_Fase_9_V5_600_Mil_Empresas.ipynb"
        nb=json.loads(filename.read_text(encoding="utf-8"))
        self.assertEqual(len(nb["cells"]),4)
        self.assertTrue(all(c.get("execution_count") is None and c.get("outputs")==[]
                            for c in nb["cells"] if c["cell_type"]=="code"))
        helper="".join(nb["cells"][2]["source"])
        runner="".join(nb["cells"][3]["source"])
        compile(helper,"helper.py","exec")
        compile(runner,"runner.py","exec")
        self.assertIn("POP_SNAPSHOT_URL=",helper)
        self.assertIn("importlib.reload(v4)",helper)
        self.assertIn("importlib.reload(v5)",helper)
        self.assertIn("safe_error_kind",helper)
        self.assertIn("populacao-municipal-2022-referencia.json",helper)
        self.assertIn("Referência municipal incompleta",helper)
        self.assertNotIn("servicodados.ibge.gov.br",helper)
        self.assertIn("AMPLIAR_600K",runner)
        self.assertIn("getpass.getpass",runner)
        self.assertIn("recent_rate_limit(secret)",runner)
        self.assertIn("COOLDOWN_HOURS=8",helper)
        self.assertIn("MIN_INTERVAL=90",helper)
        self.assertIn("MAX_DOWNLOADS_PER_SESSION=120",helper)
        self.assertIn("v5.safe_capacity(stats,1)",runner)
        self.assertNotIn("GOOGLE_PLACES_API_KEY",runner)
        self.assertNotIn("GEOAPIFY_API_KEY",runner)

if __name__=="__main__":
    unittest.main()
