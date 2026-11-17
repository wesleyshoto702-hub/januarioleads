"""Fase 0.1: offline, fail-closed guard for the legacy staging service_role JWT.
Never loads API keys, imports Overture libraries, contacts the network, or writes to DB.
"""
from __future__ import annotations

import ast
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = "https://prlrxjothrslhswpkoza.supabase.co"
SCRIPT_NAMES = (
    "scripts/import_overture_br.py",
    "scripts/expand_overture_to_100_staging.py",
    "scripts/expand_overture_600k_staging.py",
)

class Fase0LegacySecretDenialTests(unittest.TestCase):
    def test_staging_script_syntax_and_no_legacy_jwt_gate(self):
        for relative in SCRIPT_NAMES:
            with self.subTest(file=relative):
                text = (ROOT / relative).read_text(encoding="utf-8")
                ast.parse(text, filename=relative)
                self.assertIn('startswith("sb_secret_")', text)
                self.assertNotIn('startswith("eyJ")', text)
                self.assertNotIn('headers["Authorization"]', text)
                self.assertIn("SUPABASE_SECRET_KEY", text)

    def test_import_destination_must_be_exact_staging(self):
        text = (ROOT / "scripts/import_overture_br.py").read_text(encoding="utf-8")
        self.assertIn(f'base != "{STAGING}"', text)
        self.assertNotIn('base.startswith("https://") or not key', text)

    def test_staging_expanders_are_pinned_to_staging(self):
        for relative in SCRIPT_NAMES[1:]:
            with self.subTest(file=relative):
                text = (ROOT / relative).read_text(encoding="utf-8")
                self.assertIn(f'STAGING_URL = "{STAGING}"', text)

    def test_old_import_workflow_is_disabled(self):
        wf = (ROOT / ".github/workflows/import-overture-piloto-staging.yml").read_text(encoding="utf-8")
        self.assertRegex(wf, r"(?m)^  importar-piloto:\n(?:    #.*\n)*    if: false\n")
        self.assertIn("OVERTURE_STAGING_SECRET_KEY", wf)
        self.assertNotIn("OVERTURE_SUPABASE_SERVICE_ROLE_KEY", wf)
        self.assertIn(STAGING, wf)

    def test_current_colab_blocks_jwt_legacy(self):
        nb = json.loads((ROOT / "notebooks/Januario_Leads_Fase_9_V6_3_Sessao_Estendida.ipynb").read_text(encoding="utf-8"))
        assert isinstance(nb.get("cells"), list)
        body = "\n".join("".join(cell.get("source", [])) for cell in nb["cells"])
        self.assertIn('if not secret.startswith("sb_secret_")', body)
        self.assertNotIn('or secret.startswith("eyJ")', body)
        self.assertIn(STAGING, body)

if __name__ == "__main__":
    unittest.main()
