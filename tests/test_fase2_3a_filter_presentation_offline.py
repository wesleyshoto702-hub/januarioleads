"""Fase 2.3a: UI must use the same honest labels, loaded-only counters
and Instagram confidence rules that passed Deno tests. No network/real leads.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
VIEW=ROOT/"src/features/search-leads/SearchLeadsView.tsx"
PRESENTATION=ROOT/"src/features/search-leads/search-filter-presentation.ts"
FILTERS=ROOT/"src/features/search-leads/search-result-filters.ts"
COUNTS=ROOT/"src/features/search-leads/search-loaded-counts.ts"
MODAL=ROOT/"src/features/search-leads/BusinessDetailsModal.tsx"
CHANCE=ROOT/"src/features/lead-chance/lead-chance.ts"

class SearchFilterPresentationContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.view=VIEW.read_text(encoding="utf-8")
        cls.labels=PRESENTATION.read_text(encoding="utf-8")
        cls.filter=FILTERS.read_text(encoding="utf-8")
        cls.counts=COUNTS.read_text(encoding="utf-8")
        cls.modal=MODAL.read_text(encoding="utf-8")
        cls.chance=CHANCE.read_text(encoding="utf-8")

    def test_real_ui_uses_actual_tested_filters_and_options(self):
        self.assertIn('from "./search-filter-presentation"',self.view)
        self.assertIn('from "./search-loaded-counts"',self.view)
        self.assertNotIn("const RESULT_FILTER_OPTIONS:",self.view)
        self.assertNotIn("const SMART_FILTERS:",self.view)
        self.assertIn("RESULT_FILTER_OPTIONS.map(([value, label, description])",self.view)
        self.assertIn("title={description}",self.view)
        self.assertIn("manualResultFilters(value)",self.view)
        self.assertIn("matchesResultFilters(item, resultFilters, leadStatusFilter)",self.view)

    def test_loaded_counts_and_chips_do_not_claim_citywide_population(self):
        for phrase in (
            "summarizeLoadedSearchResults(resultWithExisting, visibleResults.length)",
            "countLoadedMatches(",
            "resultados carregados nesta pesquisa",
            "não ao total de empresas da cidade",
            "Há mais páginas disponíveis.",
            "Os números dos atalhos consideram somente os resultados carregados",
            "correspondências entre os resultados carregados",
            "role=\"status\" aria-live=\"polite\"",
        ):
            self.assertIn(phrase,self.view)
        self.assertNotIn("empresas encontradas\"}",self.view)
        self.assertIn("loaded.filter(",self.counts)
        self.assertIn("matchesResultFilters(item, filters, status)",self.counts)

    def test_phone_email_website_and_instagram_explanations(self):
        for phrase in (
            "Telefone informado",
            "não necessariamente ativo",
            "Número compatível com WhatsApp",
            "não confirma conta ativa",
            "E-mail com formato válido",
            "entrega não verificada",
            "Site não identificado",
            "a empresa pode ter um site",
            "Instagram não confirmado",
            "não prova ausência de Instagram",
            "Instagram com alta confiança",
            "não comprova titularidade oficial",
        ):
            self.assertIn(phrase,self.labels)
        self.assertIn("hasIdentifiedBusinessPhone(business)",self.filter)
        self.assertIn("hasUsableWhatsApp(business)",self.filter)
        self.assertIn("hasConfirmedInstagram(business)",self.filter)
        self.assertIn('instagramConfidence === "high"',self.filter)
        self.assertIn("!business.instagramNeedsReview",self.filter)

    def test_score_and_details_no_longer_assume_missing_confidence_is_high(self):
        self.assertIn('business.instagramConfidence === "high"',self.chance)
        self.assertIn("!business.instagramNeedsReview",self.chance)
        self.assertNotIn('business.instagramConfidence !== "medium"',self.chance)
        self.assertIn("hasConfirmedInstagram(business) ? business.instagram : null",self.modal)
        self.assertIn("O vínculo com a empresa não foi verificado oficialmente",self.modal)
        self.assertIn("a existência da conta não foi verificada",self.view)

    def test_no_embedded_secrets_or_external_calls(self):
        for file in (PRESENTATION,COUNTS):
            content=file.read_text(encoding="utf-8")
            for forbidden in ("supabase.co","service_role","GOOGLE_PLACES_API_KEY",
                              "sb_secret_","AIzaSy","fetch(","Deno.env","localStorage"):
                self.assertNotIn(forbidden,content)

if __name__=="__main__":
    unittest.main()
