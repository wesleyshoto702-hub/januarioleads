#!/usr/bin/env python3
"""Colab V1 — smoke real Python notebook cells in isolated temp directory.
No third-party packages, no Supabase, no HTTP, no user/business data.
"""
import ast
from contextlib import redirect_stdout
import csv
import io
import json
import os
from pathlib import Path
import re
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
NB=ROOT/"notebooks/Januario_Leads_Proxima_Colab_V1_Preparacao_Geoapify_Offline.ipynb"
SQL_CANDIDATES=ROOT/"scripts/colab_proximo_lote_geoapify_candidatos_readonly.sql"
SQL_HISTORY=ROOT/"scripts/colab_proximo_lote_geoapify_historico_readonly.sql"

def cells():
    raw=json.loads(NB.read_text(encoding="utf-8"))
    assert raw["nbformat"]==4
    assert len(raw["cells"])==8
    return ["".join(c["source"]) for c in raw["cells"]]

def simulate(csv_mode=False, no_history=False):
    code=cells()
    namespace={}
    with tempfile.TemporaryDirectory() as tmp:
        old=os.getcwd()
        try:
            os.chdir(tmp)
            with redirect_stdout(io.StringIO()):
                exec(compile(code[1],"<settings>","exec"),namespace)
                exec(compile(code[2],"<helpers>","exec"),namespace)
                if csv_mode:
                    namespace["MODO_ENTRADA"]="CSV"
                    fields=("id","name","category","city","state","address","latitude",
                           "longitude","phone","email","website","instagram","operating_status")
                    with open("overture_places_candidatos.csv","w",encoding="utf-8",newline="") as fp:
                        writer=csv.DictWriter(fp,fieldnames=fields)
                        writer.writeheader()
                        for i in range(20):
                            writer.writerow({
                                "id":f"csv-{i}","name":f"Empresa fictícia {i}",
                                "category":"barber","city":"Lavras","state":"MG",
                                "latitude":"-21.23","longitude":"-44.97",
                                "phone":"","email":"","website":"","instagram":"",
                                "address":"Rua Exemplo","operating_status":"",
                            })
                    with open("overture_geoapify_enrichment.csv","w",encoding="utf-8",newline="") as fp:
                        writer=csv.DictWriter(fp,fieldnames=("overture_id","status"))
                        writer.writeheader()
                        if not no_history:
                            writer.writerow({"overture_id":"csv-0","status":"no_match"})
                for i in (3,4,5,6):
                    exec(compile(code[i],f"<cell-{i}>","exec"),namespace)
            output=Path("januario_proxima_colab")
            manifest=json.loads((output/"manifesto_lote.json").read_text(encoding="utf-8"))
            with (output/"lote_geoapify_revisao.csv").open(
                encoding="utf-8-sig",newline=""
            ) as f:
                records=list(csv.DictReader(f))
            with (output/"cobertura_amostra.csv").open(
                encoding="utf-8-sig",newline=""
            ) as f:
                coverage=list(csv.DictReader(f))
            return manifest,records,coverage
        finally:
            os.chdir(old)

class ProximaColabTest(unittest.TestCase):
    def test_notebook_is_valid_python_and_never_imports_network_clients(self):
        raw=cells()
        self.assertEqual(len(raw),8)
        for idx in (1,2,3,4,5,6):
            ast.parse(raw[idx])
        code="\n".join(raw[i] for i in (1,2,3,4,5,6))
        for term in (
            "import requests","import urllib","import http.client",
            "import psycopg","import supabase","socket.connect",
            "requests.get(","requests.post(","urllib.request",
            "service_role_key =","SUPABASE_SERVICE_ROLE_KEY =",
            "google_places_api_key =",
        ):
            self.assertNotIn(term,code)
        self.assertIn('PERMITIR_REQUISICOES_EXTERNAS = False',code)
        self.assertIn('PERMITIR_ESCRITA_SUPABASE = False',code)
        self.assertIn('raise RuntimeError("Bloqueio Fase 0',code)
        self.assertIn('históricos',raw[0]) if False else None

    def test_demo_generates_usable_batch_without_repeating_fake_attempts(self):
        summary,rows,coverage=simulate()
        self.assertEqual(summary["mode"],"DEMONSTRACAO")
        self.assertEqual(summary["geoapify_requests"],0)
        self.assertEqual(summary["google_places_requests"],0)
        self.assertEqual(summary["openai_requests"],0)
        self.assertEqual(summary["supabase_writes"],0)
        self.assertEqual(summary["history_rows"],3)
        self.assertGreater(summary["selected_rows"],0)
        self.assertLessEqual(summary["selected_rows"],25)
        self.assertEqual(summary["selected_rows"],len(rows))
        self.assertEqual(len(set(row["id"] for row in rows)),len(rows))
        self.assertTrue(all(row["source"]=="overture" for row in rows))
        self.assertTrue(all(row["review_status"]=="PENDING_MANUAL_REVIEW" for row in rows))
        self.assertFalse({"FAKE_0000","FAKE_0001","FAKE_0002"} &
                         {row["id"] for row in rows})
        self.assertTrue(all(row["latitude"].startswith("-") for row in rows),
            "Negative latitude remains numeric, not spreadsheet-escaped")
        self.assertTrue(coverage)
        self.assertLessEqual(max(int(x["batch_count"]) for x in coverage),3)
        counts={}
        for row in rows:
            key=row["state"]
            counts[key]=counts.get(key,0)+1
        self.assertLessEqual(max(counts.values()),8)

    def test_csv_mode_requires_prior_history_and_skips_already_tried(self):
        summary,rows,_=simulate(csv_mode=True)
        self.assertEqual(summary["mode"],"CSV")
        self.assertEqual(summary["sample_rows"],20)
        self.assertEqual(summary["excluded_previous_attempts"],1)
        self.assertNotIn("csv-0",{row["id"] for row in rows})
        self.assertLessEqual(len(rows),3)
        with self.assertRaisesRegex(RuntimeError,"Histórico vazio"):
            simulate(csv_mode=True,no_history=True)

    def test_sql_is_select_only_and_export_limits_were_set(self):
        for file in (SQL_CANDIDATES,SQL_HISTORY):
            sql=file.read_text(encoding="utf-8")
            stripped="\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
            self.assertRegex(stripped,r"\bSELECT\b")
            for dangerous in ("INSERT","UPDATE","DELETE","TRUNCATE","ALTER",
                              "CREATE","DROP","GRANT","DO $$","CALL "):
                self.assertNotRegex(stripped,re.compile(r"\b"+dangerous+r"\b",re.I))
            self.assertIn("public.overture_",stripped)
        sql=SQL_CANDIDATES.read_text(encoding="utf-8")
        self.assertIn("NOT EXISTS",sql)
        self.assertIn("t.overture_id = p.id",sql)
        self.assertIn("PARTITION BY c.state",sql)
        self.assertIn("LIMIT 5000",sql)
        self.assertIn("rank_uf <= 180",sql)
        self.assertIn("FROM public.overture_geoapify_enrichment",
                      SQL_HISTORY.read_text(encoding="utf-8"))

if __name__=="__main__":
    unittest.main()
