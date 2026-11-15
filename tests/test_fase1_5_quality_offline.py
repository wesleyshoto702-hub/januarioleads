"""Fase 1.5a: offline regression checks. Never connects to a database.

The frozen JSON contains AGGREGATE COUNTS ONLY; no company contact values.
"""
import json
import re
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
SQL=ROOT/"scripts/fase1-5-auditoria-duplicacoes-contatos-readonly.sql"
FIXTURE=ROOT/"tests/fixtures/fase1_5_aggregate_quality_summary.json"
DEDUPE=ROOT/"supabase/functions/_shared/overture-search.ts"
INSTA=ROOT/"supabase/functions/_shared/public-instagram-candidate.ts"

class Phase15Audit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sql=SQL.read_text(encoding="utf-8")
        cls.fixture=json.loads(FIXTURE.read_text(encoding="utf-8"))
        cls.dedupe=DEDUPE.read_text(encoding="utf-8")
        cls.insta=INSTA.read_text(encoding="utf-8")

    def test_audit_only_readonly_queries(self):
        query="\n".join(
            line for line in self.sql.splitlines()
            if not line.lstrip().startswith("--")
        )
        self.assertEqual(query.count(";"),4)
        self.assertEqual(len(re.findall(r"(?im)^WITH\b",query)),4)
        self.assertRegex(query,re.compile(r"from public\.overture_places",re.I))
        self.assertNotRegex(query,re.compile(
            r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|"
            r"GRANT|REVOKE|COPY|EXECUTE|MERGE|CALL|PERFORM)\b",re.I))
        for secret in ("SUPABASE_SECRET","service_role","sb_secret_","Authorization:","pg_sleep"):
            self.assertNotIn(secret,query)

    def test_reconciled_identity_and_nearby_conflict_counts(self):
        f=self.fixture
        self.assertEqual(f["meta"]["environment"],"staging")
        self.assertEqual(f["identity"]["total"],f["identity"]["distinct_ids"])
        self.assertEqual(f["identity"]["total"],f["contact_format"]["total"])
        self.assertEqual(f["identity"]["rows_in_repeated_groups"]-
            f["identity"]["repeated_name_city_groups"],
            f["identity"]["excess_if_name_only_merged"])
        self.assertEqual(f["nearby"]["name_nearby_pairs_15m"],276)
        self.assertEqual(f["nearby"]["any_conflict"]+
            f["nearby"]["structurally_compatible_pairs"],276)
        self.assertLessEqual(f["nearby"]["address_conflicts"],f["nearby"]["any_conflict"])
        self.assertLessEqual(f["nearby"]["category_conflicts"],f["nearby"]["any_conflict"])
        self.assertLessEqual(f["nearby"]["phone_conflicts"],f["nearby"]["any_conflict"])

    def test_contact_shapes_are_not_verifications(self):
        f=self.fixture["contact_format"]
        self.assertEqual(f["phone_present"]-f["plausible_br_phone_length_prefix"],
                         f["phone_other_format"])
        self.assertEqual(f["instagram_present"],42742)
        self.assertEqual(f["instagram_content_not_profiles"],618)
        self.assertEqual(f["instagram_homepage"],182)
        self.assertEqual(f["website_invalid_http_format"],1)
        self.assertEqual(f["email_invalid_basic"],0)
        self.assertIn("not verified contacts",self.fixture["meta"]["note"].lower())

    def test_conservative_dedup_checks_conflicts_before_distance(self):
        section=self.dedupe.split(
            "export function isSameLocatedOvertureBusiness",1
        )[1].split("export function enoughRelevantResults",1)[0]
        self.assertIn("if(a.id===b.id)return true;",section)
        self.assertIn("a.category!==b.category",section)
        self.assertIn("addrA!==addrB",section)
        self.assertIn("phoneA!==phoneB",section)
        self.assertIn("Math.asin",section)
        self.assertLess(section.index("addrA!==addrB"),section.index("Math.asin")
                        if "Math.asin" in section else section.index("Math.sin"))
        self.assertIn("return Boolean(addrA && addrB && addrA===addrB)",section)

    def test_instagram_validator_preserves_unverified_status(self):
        self.assertIn("parts.length !== 1",self.insta)
        self.assertIn('"p", "reel", "reels", "stories"',self.insta)
        self.assertIn('confidence: "medium"',self.insta)
        self.assertIn("evidenceUrls: []",self.insta)

    def test_no_aggregate_fixture_contains_personal_contacts(self):
        raw=FIXTURE.read_text(encoding="utf-8")
        self.assertNotRegex(raw,re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"))
        for secret in ("sb_secret_","eyJhbGciOi","BEGIN PRIVATE KEY"):
            self.assertNotIn(secret,raw)

if __name__=="__main__":
    unittest.main()
