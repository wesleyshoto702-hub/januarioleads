"""Fase 2.4a: validate that the ACTUAL search path uses privacy-safe metrics.

All checks are static/offline: no browser, external API, secrets or database.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
HTTP=ROOT/"src/features/search-leads/search-businesses-http.ts"
WRAPPER=ROOT/"src/features/search-leads/search-businesses.ts"
VIEW=ROOT/"src/features/search-leads/SearchLeadsView.tsx"
METRICS=ROOT/"src/features/search-leads/search-metrics.ts"
TEST=ROOT/"tests/fase2_4a_search_metrics_offline.test.ts"

class SearchObservabilityContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http=HTTP.read_text(encoding="utf-8")
        cls.wrapper=WRAPPER.read_text(encoding="utf-8")
        cls.view=VIEW.read_text(encoding="utf-8")
        cls.metrics=METRICS.read_text(encoding="utf-8")
        cls.test=TEST.read_text(encoding="utf-8")

    def test_measured_transport_is_used_in_real_search_flow(self):
        self.assertIn('from "./search-metrics.ts"',self.http)
        self.assertIn("onObservation?:",self.http)
        self.assertIn("clockNowMs?:",self.http)
        self.assertIn("const started=observe?clock():0",self.http)
        self.assertIn("httpAttempts=1",self.http)
        self.assertIn("observedHttpStatus=response.status",self.http)
        self.assertIn("const outcome=await request()",self.http)
        self.assertIn("httpStatusClass(observedHttpStatus)",self.http)
        self.assertIn("returnedCount:outcome.ok?outcome.results.length:0",self.http)
        self.assertIn('import type { SearchHttpObservation } from "./search-metrics"',self.wrapper)
        self.assertIn("...(onObservation ? {onObservation} : {})",self.wrapper)
        self.assertIn('import { createSearchMetricsCollector } from "./search-metrics"',self.view)
        self.assertIn("searchMetricsRef.current.observe",self.view)
        self.assertIn("useRef(createSearchMetricsCollector())",self.view)

    def test_only_numeric_and_enumerated_fields_can_be_observed(self):
        region=self.http.split("      observe({",1)[1].split("      });",1)[0]
        self.assertIn("page:",region)
        self.assertIn("outcome:",region)
        self.assertIn("elapsedMs:",region)
        self.assertIn("httpAttempts",region)
        self.assertIn("httpStatusClass:",region)
        self.assertIn("returnedCount:",region)
        for secret_field in ("segment","city","state","accessToken","Authorization",
                             "apikey","phone","email","placeId","response.body",
                             "requestUrl","requestBody","searchText"):
            self.assertNotIn(secret_field,region)
        self.assertIn("catch{",self.http.split("if(observe){",1)[1])
        for forbidden in ("fetch(","localStorage","sessionStorage","console.log",
                          "console.warn","Deno.env","sendBeacon","indexedDB"):
            self.assertNotIn(forbidden,self.metrics)

    def test_aggregates_are_bounded_and_labelled_as_local(self):
        self.assertIn("createSearchMetricsCollector(maxSamples=256)",self.metrics)
        self.assertIn("Math.min(maxSamples,1000)",self.metrics)
        self.assertIn("slice(-cap)",self.metrics)
        self.assertIn("percentileNearestRank",self.metrics)
        self.assertIn("failureRatePct:",self.metrics)
        self.assertIn("p50SuccessMs:",self.metrics)
        self.assertIn("p95SuccessMs:",self.metrics)
        self.assertIn("byHttpStatusClass:",self.metrics)
        self.assertIn("No network, storage, logging",self.metrics)

    def test_tests_use_only_mocked_public_endpoints(self):
        for required in ("example.invalid", "SYNTHETIC", "five Overture mock pages",
                         "fixed synthetic HTTP durations","no PII/secrets"):
            self.assertIn(required,self.test)
        for forbidden in ("sb_secret_","service_role=", "AIzaSy", "eyJhbGciOi"):
            self.assertNotIn(forbidden,self.test)

if __name__=="__main__":
    unittest.main()
