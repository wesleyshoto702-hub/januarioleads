"""Offline regression: Fase 1.4 must remain read-only, complete and honest.

Never connects to Supabase, uses credentials, or exports customer/lead rows.
"""
import csv
import io
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs/FASE-1-4-MATRIZ-COBERTURA-216-NICHOS.csv"
UF = ROOT / "docs/FASE-1-4-COBERTURA-27-UFS.csv"
CASES = ROOT / "docs/FASE-1-4-COBERTURA-18-CENARIOS.csv"
FIXTURE = ROOT / "tests/fixtures/fase1_4_coverage_summary.json"
SQL = ROOT / "scripts/fase1-4-auditoria-cobertura-municipios-readonly.sql"
SQL_EXTRAS = ROOT / "scripts/fase1-4-recortes-uf-18-casos-readonly.sql"
CATALOG = ROOT / "supabase/functions/_shared/niche-catalog.ts"
ADAPTER = ROOT / "supabase/functions/_shared/overture-search.ts"


def rows(path):
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def source_map(code, begin, end):
    section = code.split(begin, 1)[1].split(end, 1)[0]
    result = {}
    for match in re.finditer(r'"([^"]+)":\s*\[([^\]]+)\]', section):
        result[match.group(1)] = re.findall(r'"([^"]+)"', match.group(2))
    return result


def all_niches(code):
    blocks = re.findall(r'"items"\s*:\s*\[([^\]]+)\]', code)
    return [x for block in blocks for x in re.findall(r'"([^"]+)"', block)]


class TestPhase14Coverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.matrix = rows(MATRIX)
        cls.uf = rows(UF)
        cls.cases = rows(CASES)
        cls.fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
        cls.sql = SQL.read_text(encoding="utf-8")
        cls.extras = SQL_EXTRAS.read_text(encoding="utf-8")
        cls.catalog = CATALOG.read_text(encoding="utf-8")
        cls.adapter = ADAPTER.read_text(encoding="utf-8")

    def test_sql_is_aggregate_only_and_safe(self):
        for document, expected_statements in ((self.sql, 1), (self.extras, 2)):
            raw = "\n".join(
                line for line in document.splitlines()
                if not line.lstrip().startswith("--")
            )
            self.assertEqual(raw.count(";"), expected_statements)
            self.assertNotRegex(
                raw,
                re.compile(
                    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|"
                    r"CALL|PERFORM|EXECUTE|COPY|MERGE|VACUUM)\b", re.I
                ),
            )
            self.assertNotRegex(raw, re.compile(r"auth\.users|service_role|pg_sleep|http", re.I))
            self.assertIn("FROM public.overture_places", raw)

    def test_full_catalog_mappings_reflected_by_sql(self):
        old = source_map(self.adapter, "export const OVERTURE_CATEGORIES",
                         "export const OVERTURE_CATEGORY_EXPANSIONS")
        expansions = source_map(self.adapter, "export const OVERTURE_CATEGORY_EXPANSIONS",
                                "export const OVERTURE_CATEGORY_PHASE13")
        stage13 = source_map(self.adapter, "export const OVERTURE_CATEGORY_PHASE13",
                             "export type OverturePlace")
        niches = all_niches(self.catalog)
        self.assertEqual(len(niches), 216)
        self.assertEqual(len(set(niches)), 216)
        expected = set()
        for niche in niches:
            original = set(old.get(niche, []) + expansions.get(niche, []))
            prepared = original | set(stage13.get(niche, []))
            expected.update(("old", niche, c) for c in original)
            expected.update(("prepared", niche, c) for c in prepared)
        section = self.sql.split("mapping(version,niche,category) AS (VALUES", 1)[1].split(
            "), locations AS", 1
        )[0]
        sql_values = {
            tuple(part.replace("''", "'") for part in parts)
            for parts in re.findall(
                r"\('((?:[^']|'')*)','((?:[^']|'')*)','((?:[^']|'')*)'\)", section
            )
        }
        self.assertEqual(sql_values, expected)
        self.assertEqual(len(sql_values), 439)

    def test_snapshot_complete_and_reconciles(self):
        self.assertEqual(len(self.matrix), 432)
        self.assertEqual(len(self.uf), 27)
        self.assertEqual(len(self.cases), 36)
        self.assertEqual(set(x["version"] for x in self.matrix), {"old", "prepared"})
        self.assertEqual(set(x["version"] for x in self.cases), {"old", "prepared"})
        summary = self.fixture["summary"]
        for version in ("old", "prepared"):
            records = [x for x in self.matrix if x["version"] == version]
            self.assertEqual(len(records), 216)
            self.assertEqual(
                len(set(x["niche"] for x in records)), 216
            )
            for x in records:
                self.assertEqual(int(x["total_cities"]), 5572)
                self.assertEqual(
                    int(x["cities_limited"])
                    + int(x["cities_with_more"])
                    + int(x["cities_without_candidates"]), 5572
                )
                self.assertEqual(
                    int(x["cities_limited"]) + int(x["cities_with_more"]),
                    int(x["cities_with_any"]),
                )
            self.assertEqual(sum(int(x["cities_without_candidates"]) for x in records),
                             summary[version]["sem_candidatos"])
            self.assertEqual(sum(int(x["cities_limited"]) for x in records),
                             summary[version]["limitada"])
            self.assertEqual(sum(int(x["cities_with_more"]) for x in records),
                             summary[version]["mais_candidatos"])
            self.assertEqual(sum(int(x["candidate_memberships"]) for x in records),
                             summary[version]["candidate_memberships"])
            self.assertEqual(summary[version]["combinations"], 216 * 5572)
        self.assertEqual(summary["old"]["mais_candidatos"], 596)
        self.assertEqual(summary["prepared"]["mais_candidatos"], 596)
        self.assertEqual(summary["old"]["sem_candidatos"] - summary["prepared"]["sem_candidatos"],
                         3904)
        self.assertEqual(summary["prepared"]["candidate_memberships"] -
                         summary["old"]["candidate_memberships"], 4291)

    def test_uf_snapshot_sums_to_national(self):
        expected = self.fixture["summary"]["prepared"]
        self.assertEqual(sum(int(x["cities"]) for x in self.uf), 5572)
        for source,target in (
            ("combinations","combinations"),
            ("no_candidates","sem_candidatos"),
            ("limited","limitada"),
            ("more_candidates","mais_candidatos"),
            ("candidate_memberships","candidate_memberships"),
        ):
            self.assertEqual(
                sum(int(x[source]) for x in self.uf), expected[target]
            )
        self.assertEqual(len({x["state"] for x in self.uf}), 27)
        self.assertTrue(all(int(x["more_candidates"]) > 0 for x in self.uf))

    def test_case_zero_and_success_and_version_pairs(self):
        self.assertEqual(len({
            (x["state"],x["city_key"],x["niche"]) for x in self.cases
        }), 18)
        for version in ("old", "prepared"):
            for x in [c for c in self.cases if c["version"] == version]:
                candidates = int(x["candidates"])
                phones = int(x["plausible_phones"])
                expected = ("sem_candidatos" if candidates == 0 else
                            "mais_candidatos" if candidates >= 8 and phones >= 5
                            else "limitada")
                self.assertEqual(x["coverage"], expected)
        found = {
            (x["state"],x["city_key"],x["niche"]): x
            for x in self.cases if x["version"] == "prepared"
        }
        self.assertEqual(found[("MG","lavras","Barbearia")]["coverage"], "sem_candidatos")
        self.assertEqual(found[("DF","brasilia","Clínica Odontológica")]["coverage"],
                         "mais_candidatos")
        self.assertEqual(int(found[("RJ","rio de janeiro","Restaurante")]["candidates"]), 11)
        self.assertIn("return results.length>=8 &&", self.adapter)
        self.assertIn("phoneUseful(x.phone||x.internationalPhone)).length>=5", self.adapter)

    def test_all_outputs_no_customer_pii(self):
        for path in (MATRIX, UF, CASES, FIXTURE):
            raw = path.read_text(encoding="utf-8")
            self.assertNotRegex(raw, re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"))
            self.assertNotRegex(raw, re.compile(r"sb_secret_|service_role|eyJhbGciOi",re.I))
            self.assertNotIn("customer_name", raw)


if __name__ == "__main__":
    unittest.main()
