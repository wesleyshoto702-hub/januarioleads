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
        self.assertEqual(importer.normalize("São  João  d'Água"), "sao joao d'agua")
        self.assertEqual(importer.normalize("LAVRAS"), "lavras")

    def test_lead_quality_prioritizes_contactability(self):
        empty = {"name": "Barbearia A", "category": "barber", "confidence": 0.8}
        with_contacts = {**empty, "phone": "+5535999999999", "website": "https://example.org"}
        self.assertGreater(importer.lead_quality(with_contacts), importer.lead_quality(empty))

    def test_first_ignores_missing_contact_fields(self):
        self.assertEqual(importer.first([None, "", "+5535999999999"]), "+5535999999999")
        self.assertIsNone(importer.first(None))


if __name__ == "__main__":
    unittest.main()
