"""Offline guardrails for the real Buscar Leads UI/HTTP seam (no browser/net)."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
VIEW=ROOT/"src/features/search-leads/SearchLeadsView.tsx"
FILTER=ROOT/"src/features/search-leads/search-result-filters.ts"
MERGE=ROOT/"src/features/search-leads/search-page-merge.ts"
HTTP=ROOT/"src/features/search-leads/search-businesses-http.ts"
WRAPPER=ROOT/"src/features/search-leads/search-businesses.ts"
IDENTITY=ROOT/"src/features/search-leads/identity.ts"

class SearchFlowContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.view=VIEW.read_text(encoding="utf-8")
        cls.filter=FILTER.read_text(encoding="utf-8")
        cls.merge=MERGE.read_text(encoding="utf-8")
        cls.http=HTTP.read_text(encoding="utf-8")
        cls.wrapper=WRAPPER.read_text(encoding="utf-8")
        cls.identity=IDENTITY.read_text(encoding="utf-8")

    def test_ui_calls_the_same_functions_tested_offline(self):
        for marker in (
            'from "./search-result-filters"',
            'from "./search-page-merge"',
            'matchesResultFilters(item, resultFilters, leadStatusFilter)',
            "mergeSearchPageResults(",
            "findBusinessDuplicate(located, existingLeads)",
        ):
            self.assertIn(marker,self.view)
        self.assertNotIn("function matchesResultFilters(",self.view)
        self.assertNotIn("function hasConfirmedInstagram(",self.view)
        self.assertIn("const requestId = ++searchRequestIdRef.current",self.view)
        self.assertIn("if (requestId !== searchRequestIdRef.current) return",self.view)
        self.assertIn("if (append) setLoadingMore(false)",self.view)
        self.assertIn("item.source===\"overture\" || item.source===\"geoapify\"",self.view)

    def test_client_session_is_checked_before_http(self):
        self.assertIn("const accessToken=await getAccessToken()",self.wrapper)
        self.assertIn("return requestSearchBusinesses(input",self.wrapper)
        self.assertIn("if(!deps.accessToken?.trim())",self.http)
        self.assertIn('Authorization:',self.http)
        self.assertIn("if(response.status===401)",self.http)
        self.assertIn("if(!response.ok)",self.http)
        self.assertIn("return parsed??failures.malformed;",self.http)
        self.assertNotIn("GOOGLE_PLACES_API_KEY",self.http)
        self.assertNotIn("SUPABASE_SERVICE_ROLE_KEY",self.http)

    def test_no_false_instagram_verification_or_shared_phone_merge(self):
        self.assertIn('business.instagramConfidence === "high"',self.filter)
        self.assertIn('b.instagramConfidence==="high"',self.merge)
        self.assertIn("if(knownDifferentCities)return false",self.identity)
        self.assertNotIn("businessPhone === leadPhone",self.identity)
        self.assertIn("businessAddress",self.identity)
        self.assertIn('this is NOT',self.merge) if False else None

if __name__=="__main__":
    unittest.main()
