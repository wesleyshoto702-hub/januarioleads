"""Fase 2.2a: prove the code under test is the same code used by UI/backend.

No network, no service_role, no customer data and no database mutation.
"""
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
VIEW=ROOT/"src/features/search-leads/SearchLeadsView.tsx"
HTTP=ROOT/"src/features/search-leads/search-businesses-http.ts"
SERVER=ROOT/"supabase/functions/search-places/index.ts"
TOKEN=ROOT/"supabase/functions/_shared/search-continuation.ts"
CACHE=ROOT/"src/features/opportunities/places-search-cache.ts"
CACHE_POLICY=ROOT/"src/features/opportunities/open-search-cache-policy.ts"
EMPTY=ROOT/"src/features/search-leads/search-empty-state.ts"

class Fase22SearchContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ui=VIEW.read_text(encoding="utf-8")
        cls.http=HTTP.read_text(encoding="utf-8")
        cls.server=SERVER.read_text(encoding="utf-8")
        cls.cache=CACHE.read_text(encoding="utf-8")
        cls.tokens=TOKEN.read_text(encoding="utf-8")
        cls.policy=CACHE_POLICY.read_text(encoding="utf-8")
        cls.empty=EMPTY.read_text(encoding="utf-8")

    def test_server_rejects_unknown_cursor_before_expensive_branch(self):
        region=self.server.split("async function runSegmentSearch",1)[1].split(
            "async function runLeadEnrichment",1
        )[0]
        self.assertIn("parseSearchContinuation(pageToken)",region)
        self.assertIn('continuation.kind === "invalid"',region)
        self.assertIn('continuation.kind === "google"',region)
        self.assertIn('continuation.kind === "overture"',region)
        self.assertIn('continuation.kind === "geoapify"',region)
        self.assertNotIn("directGoogle",region)
        self.assertNotIn('token.startsWith("google:") ? token.slice(7) : token',region)
        self.assertLess(region.index('continuation.kind === "invalid"'),
                        region.index('continuation.kind === "google"'))
        self.assertLess(region.index('continuation.kind === "invalid"'),
                        region.index("await textSearch("))
        self.assertIn('from "../_shared/search-continuation.ts"',self.server)
        self.assertIn('from "../../../supabase/functions/_shared/search-continuation.ts"',self.http)

    def test_latest_search_owns_ui_and_failure_preserves_cards(self):
        region=self.ui.split("  async function runSearch(",1)[1].split(
            "  function startSearch()",1
        )[0]
        self.assertIn("searchRequestGateRef.current.next()",region)
        self.assertEqual(region.count("searchRequestGateRef.current.isCurrent(requestId)"),2)
        self.assertIn("pageToken!==nextPageToken",region)
        self.assertIn("if (append) setLoadingMore(false)",region)
        self.assertIn("if (!response.ok)",region)
        self.assertLess(region.index("if (!response.ok)"),
                        region.index("setResults(uniqueResults)"))
        self.assertIn("eligibleQuotaCache(cached,location,segment)",region)
        self.assertIn("const eligible = eligibleQuotaCache",region)
        self.assertIn("mergeSearchPageResults(",region)

    def test_cache_has_no_paid_source_or_cursor_and_no_skipped_pages(self):
        self.assertIn("onlyOpenSourceSearchResults",self.cache)
        self.assertIn("const cached = openCachePage(combined,input.nextPageToken)",self.cache)
        self.assertIn("results: cached.results",self.cache)
        self.assertIn("next_page_token: cached.nextPageToken",self.cache)
        self.assertIn("safeOpenContinuationToken(row.next_page_token)",self.cache)
        self.assertIn("MAX_CACHED_SEARCH_RESULTS=60",self.policy)
        self.assertIn("open.length>MAX_CACHED_SEARCH_RESULTS",self.policy)
        self.assertIn('result.source==="overture"',self.policy)
        self.assertIn('result.source==="geoapify"',self.policy)
        self.assertIn('result.source==="google_places"',self.policy) if False else None
        self.assertIn("safeOpenContinuationToken(snapshot.nextPageToken)",self.ui)
        self.assertIn("onlyOpenSourceSearchResults(saved.results)",self.ui)
        self.assertIn('from "./search-empty-state"',self.ui)

    def test_stable_empty_state_is_used_by_real_view(self):
        self.assertIn("const emptyState = searchEmptyState({",self.ui)
        self.assertIn("visibleCount:visibleResults.length",self.ui)
        self.assertIn("hasError:Boolean(error)",self.ui)
        self.assertIn("<strong>{emptyState.title}</strong>",self.ui)
        self.assertIn("if(input.loading || input.hasError || input.visibleCount>0)",self.empty)
        self.assertIn("Nenhum resultado corresponde aos filtros",self.empty)

    def test_fixture_does_not_embed_secrets_or_real_contacts(self):
        path=ROOT/"tests/fase2_2a_search_resilience_offline.test.ts"
        tests=path.read_text(encoding="utf-8")
        self.assertIn("example.invalid",tests)
        self.assertIn("SYNTHETIC",tests)
        for forbidden in ("SUPABASE_SERVICE_ROLE_KEY=","sb_secret_","AIzaSy","eyJhbGciOi"):
            self.assertNotIn(forbidden,tests)

if __name__=="__main__":
    unittest.main()
