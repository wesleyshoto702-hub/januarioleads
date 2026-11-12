"""Offline tests for safe national Overture importer. No API keys or network."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "import_overture_br.py"
spec = importlib.util.spec_from_file_location("import_overture_br", SCRIPT)
importer = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(importer)


class ImporterSafetyTests(unittest.TestCase):
    def test_all_27_brazilian_ufs_covered(self):
        self.assertEqual(len(importer.STATE_CODES), 27)
        self.assertEqual(len(set(importer.STATE_CODES)), 27)
        self.assertIn("DF", importer.STATE_CODES)
        self.assertIn("MG", importer.STATE_CODES)

    def test_ibge_uses_state_specific_municipal_archive(self):
        url = importer.state_boundaries_url("MG")
        self.assertTrue(url.endswith("/UFs/MG/MG_Municipios_2024.zip"))
        self.assertNotIn("/Brasil/BR_", url)
        with self.assertRaises(ValueError):
            importer.state_boundaries_url("../prod")

    def test_normalizes_brazilian_city_and_names(self):
        self.assertEqual(importer.normalize("São  João  d'Água"), "sao joao d agua")
        self.assertEqual(importer.normalize("LAVRAS"), "lavras")

    def test_lead_quality_prioritizes_contactability(self):
        empty = {"name": "Barbearia A", "category": "barber", "confidence": 0.8}
        with_contacts = {**empty, "phone": "+5535999999999", "website": "https://example.org"}
        self.assertGreater(importer.lead_quality(with_contacts), importer.lead_quality(empty))

    def test_first_ignores_missing_contact_fields(self):
        self.assertEqual(importer.first([None, "", "+5535999999999"]), "+5535999999999")
        self.assertIsNone(importer.first(None))

    def test_social_contacts_and_shorteners_are_not_websites(self):
        for url in ("https://wa.me/5535999999999", "https://instagram.com/empresa",
                    "https://bit.ly/agendar", "https://linktr.ee/empresa",
                    "https://www.facebook.com/empresa"):
            with self.subTest(url=url):
                self.assertFalse(importer.is_business_website(url))
        self.assertTrue(importer.is_business_website("https://minhaempresa.com.br"))
        self.assertTrue(importer.is_business_website("https://sites.google.com/view/empresa"))
        self.assertEqual(importer.first_website([
            "https://wa.me/123456", "https://minhaempresa.com.br"
        ]), "https://minhaempresa.com.br")

    def test_diverse_selection_preserves_website_free_prospects(self):
        with_site = [
            {"id": f"site-{i}", "phone": "+5535999999999", "email": "a@exemplo.com",
             "website": f"https://example{i}.com.br", "category": "hotel"}
            for i in range(30)
        ]
        without_site = [
            {"id": f"sem-site-{i}", "phone": "+5535999999999", "email": None,
             "website": None, "category": "hotel"}
            for i in range(20)
        ]
        chosen = importer.select_diverse_pool(with_site + without_site, 30)
        self.assertEqual(len(chosen), 30)
        self.assertEqual(len(set(row["id"] for row in chosen)), 30)
        self.assertGreaterEqual(sum(not row["website"] for row in chosen), 12)

    def test_diverse_selection_fills_quota_when_all_have_website(self):
        rows = [
            {"id": f"site-{i}", "phone": "+5535999999999", "website": "https://a.com",
             "email": None, "category": "hotel"}
            for i in range(20)
        ]
        chosen = importer.select_diverse_pool(rows, 15)
        self.assertEqual(len(chosen), 15)
        self.assertTrue(all(row["website"] for row in chosen))


if __name__ == "__main__":
    unittest.main()
