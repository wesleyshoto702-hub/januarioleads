"""2.6a contract: ensure the LIVE Edge Function uses tested fail-closed gates.
Offline source inspection only. Does not claim Supabase deployment or billing proof.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
EDGE=ROOT/"supabase/functions/search-places/index.ts"
GEO=ROOT/"supabase/functions/_shared/geoapify-search.ts"
APPROVAL=ROOT/"supabase/functions/_shared/external-provider-approval.ts"
EXECUTION=ROOT/"supabase/functions/_shared/external-provider-execution.ts"
CRM=ROOT/"src/routes/app.tsx"
TESTS=ROOT/"tests/fase2_6a_zero_paid_providers_offline.test.ts"

class ZeroPaidProvidersOfflineContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.edge=EDGE.read_text(encoding="utf-8")
        cls.geo=GEO.read_text(encoding="utf-8")
        cls.approval=APPROVAL.read_text(encoding="utf-8")
        cls.execution=EXECUTION.read_text(encoding="utf-8")
        cls.crm=CRM.read_text(encoding="utf-8")
        cls.tests=TESTS.read_text(encoding="utf-8")

    def test_edge_direct_paid_google_fetches_are_both_reserved(self):
        t=self.edge.split("async function textSearch(",1)[1].split(
            "async function placeDetails(",1)[0]
        d=self.edge.split("async function placeDetails(",1)[1].split(
            "function mergeProviderResults(",1)[0]
        for scope,operation in (
            (t,"text_search_enterprise"),(d,"place_details_enterprise")
        ):
            self.assertIn("const reserved = await runReservedExternalCall(",scope)
            self.assertIn('claimExternalSearchCall("google_places"',scope)
            self.assertIn(operation,scope)
            self.assertLess(scope.index("runReservedExternalCall("),
                scope.index("() => fetch("))
            self.assertIn("if (!reserved.ok)",scope)
            self.assertIn("const response = reserved.value",scope)
        self.assertIn("externalSearchDailyCap(provider)",self.edge)
        self.assertIn('response?.ok && (await response.json())===true',self.edge)

    def test_geo_actual_requests_are_reserved_before_network(self):
        a=self.geo.split("async function cityPlaceId(",1)[1].split(
            "function fromFeature(",1
        )[0]
        b=self.geo.split("export async function searchGeoapifyFirst(",1)[1].split(
            "export function needsGoogleSupplement(",1
        )[0]
        self.assertIn("await runReservedExternalCall(",a)
        self.assertIn('reserveCredit("geocode")',a)
        self.assertIn("() => jsonWithinTimeout(url, GEOCODE_TIMEOUT_MS)",a)
        self.assertIn("if (!geocode.ok) return null",a)
        self.assertIn("await runReservedExternalCall(",b)
        self.assertIn('input.reserveCredit("places")',b)
        self.assertIn("() => jsonWithinTimeout(url, PLACES_TIMEOUT_MS)",b)
        self.assertIn('if (!input.reserveCredit) return { ok: false, reason: "NOT_CONFIGURED" }',b)
        self.assertIn("if (!places.ok)",b)

    def test_search_mocks_share_the_real_edge_provider_eligibility(self):
        route=self.edge.split("async function runSegmentSearch(",1)[1].split(
            "async function runLeadEnrichment(",1
        )[0]
        self.assertIn('if (continuation.kind === "overture")',route)
        self.assertIn('const overtureFetched = continuation.kind === "geoapify"',route)
        self.assertIn("mayContactExternalPlacesProvider(",route)
        self.assertIn('"geoapify", geoApiKey',route)
        self.assertIn('"google_places", googleApiKey',route)
        self.assertIn("searchGeoapifyFirst({",route)
        self.assertIn('reserveCredit:(operation)=>claimExternalSearchCall("geoapify"',route)
        self.assertIn("if (!googleAllowed)",route)
        self.assertIn("if (continuation.kind === \"google\")",route)

    def test_billable_instagram_is_not_unlocked_by_only_the_api_key(self):
        self.assertIn("approvedInstagramWebSearchDailyCap(",self.edge)
        self.assertIn('"OPENAI_INSTAGRAM_WEB_SEARCH_SPEND_APPROVED"',self.edge)
        self.assertIn('"OPENAI_INSTAGRAM_WEB_SEARCH_DAILY_CAP"',self.edge)
        self.assertIn('adminRest("rpc/claim_saas_openai_web_search_budget"',self.edge)
        claim=self.edge.split("async function claimInstagramWebSearchBudget(",1)[1].split(
            "async function claimApiBudget(",1
        )[0]
        self.assertIn('return Boolean(response?.ok && (await response.json())===true)',claim)
        self.assertIn("catch {",claim)
        self.assertIn("return false",claim)
        presence=self.edge.split("async function runPresenceDiscovery(",1)[1].split(
            "async function handleRequest(",1
        )[0]
        self.assertIn("claimInstagramWebSearchBudget(userId)",presence)
        self.assertIn("() => discoverInstagramOnWeb(",presence)
        self.assertIn("if (!reserved.ok)",presence)
        self.assertIn("rawCandidates = reserved.value",presence)
        self.assertIn("runPresenceDiscovery(requestBody,userId)",self.edge)

    def test_external_helper_is_standalone_privacy_preserving_and_fail_closed(self):
        self.assertIn("await reserve()",self.execution)
        self.assertIn('if (!approved) return { ok: false, reason: "BUDGET_DENIED" }',self.execution)
        self.assertIn("return { ok: true, value: await request() }",self.execution)
        for src in (self.execution,self.approval):
            for banned in ("fetch(","Deno.env","console.log","localStorage",
                           "service_role","sb_secret_","http://","https://"):
                self.assertNotIn(banned,src)
        self.assertIn("approvedExternalPlacesDailyCap(",self.approval)
        self.assertIn("mayContactExternalPlacesProvider(",self.approval)
        self.assertIn("approvedInstagramWebSearchDailyCap(",self.approval)

    def test_crm_paths_remain_independent_from_paid_lookup_dispatch(self):
        self.assertIn("saveRemoteLead(newLead)",self.crm)
        self.assertIn("updateLeadLocally(lead.id, toggleLeadFavorite)",self.crm)
        self.assertIn("const nextLead = changeLeadStatus(lead, status)",self.crm)
        app_journey=self.crm.split("async function addFoundLeadConfirmed(",1)[1].split(
            "function navigateTo(",1
        )[0]
        for term in ("textSearch(","searchGeoapifyFirst(","fetch(\"https://places.googleapis.com"):
            self.assertNotIn(term,app_journey)
        self.assertIn("ZERO real calls",self.tests)
        self.assertIn("GEO_KEY_FAKE",self.tests)
        self.assertIn("runReservedExternalCall(",self.tests)

if __name__=="__main__":
    unittest.main()
