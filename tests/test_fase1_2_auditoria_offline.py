"""Offline checks: Fase 1.2 SQL must remain read-only and category mapping reproducible."""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
SQL=ROOT/"scripts/fase1-2-auditoria-overture-somente-leitura.sql"
CATALOG=ROOT/"supabase/functions/_shared/overture-search.ts"
REPORT=ROOT/"docs/FASE-1-2-AUDITORIA-QUALIDADE-OVERTURE-2026-11-15.md"

class Fase12AuditSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql=SQL.read_text(encoding="utf-8")
        cls.source=CATALOG.read_text(encoding="utf-8")
        cls.report=REPORT.read_text(encoding="utf-8")

    def test_sql_aggregate_only(self):
        lines=[line for line in self.sql.splitlines() if not line.lstrip().startswith("--")]
        sql="\n".join(lines)
        self.assertEqual(sql.count(";"),6)
        self.assertEqual(len(re.findall(r"(?im)^SELECT\b",sql)),4)
        self.assertEqual(len(re.findall(r"(?im)^WITH\b",sql)),2)
        self.assertNotRegex(sql,re.compile(
            r"\b(INSERT|DELETE|UPDATE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE|PERFORM)\b",
            re.I))
        self.assertNotRegex(sql,re.compile(r"(?:http[s]?://|auth\.users|service_role|apikey)",re.I))
        self.assertEqual(sql.count("FROM public.overture_places"),6)

    def test_exact_category_snapshot_matches_adapter(self):
        source=self.source.split("export type OverturePlace",1)[0]
        expected={value for value in re.findall(r'"([a-z][a-z0-9_]+)"',source)
                  if re.fullmatch(r"[a-z]+(?:_[a-z]+)*",value)}
        snippet=self.sql.split("WITH mapped_categories(cat) AS (VALUES",1)[1].split(
            "\nSELECT count(*) AS all_places",1)[0]
        found=set(re.findall(r"\('([a-z][a-z0-9_]+)'\)",snippet))
        self.assertEqual(found,expected)
        self.assertEqual(len(found),186)

    def test_report_does_not_claim_verification_or_release(self):
        self.assertIn("não verifica titularidade",self.report)
        self.assertIn("não foi conferida",self.report)
        self.assertIn("data_release = 'latest'",self.report)
        self.assertIn("Fase 0 continua pendente",self.report)

if __name__=="__main__":
    unittest.main()
