import { buildFactualBusinessDescription, displayBusinessDescription } from "./business-description.ts";
import type { BusinessSearchResult } from "../search-leads/types.ts";

function business(overrides: Partial<BusinessSearchResult>): BusinessSearchResult {
  return {
    placeId: "test", name: "Farmácia do Povo", primaryCategory: null,
    categories: [], description: null, address: "Centro", neighborhood: null,
    city: "Lavras", state: "MG", phone: null, internationalPhone: null,
    rating: null, reviewCount: null, isOpenNow: null, openingHours: [],
    website: null, instagram: null, googleMapsUrl: null, businessStatus: null,
    latitude: null, longitude: null, ...overrides,
  };
}
Deno.test("Geoapify category codes are not shown in user-facing descriptions", () => {
  const result = buildFactualBusinessDescription(business({
    source: "geoapify",
    primaryCategory: "commercial.health_and_beauty",
    categories: ["commercial.health_and_beauty"],
  }), "Farmácia");
  if (!result.includes("Farmácia") || /commercial|health_and_beauty|google|geoapify/i.test(result)) {
    throw Error("Must show the Portuguese niche, not a provider classification: " + result);
  }
});
Deno.test("Descriptions without a niche still avoid provider names", () => {
  const result = buildFactualBusinessDescription(business({
    source: "google_places", rating: 4.5, reviewCount: 12,
    businessStatus: "OPERATIONAL",
  }));
  if (/google|geoapify|commercial/i.test(result)) {
    throw Error("Provider branding leaked into the public description");
  }
});
Deno.test("Saved legacy provider descriptions are regenerated for display without rewriting records", () => {
  const original = "Estabelecimento no Google nas categorias Commercial Health And Beauty.";
  const result = displayBusinessDescription(business({
    factualDescription: original,
    primaryCategory: "commercial.health_and_beauty",
  }), "Farmácia");
  if (/google|commercial|health_and_beauty/i.test(result) || !result.includes("Farmácia")) {
    throw Error("Legacy provider description was not neutralized: " + result);
  }
});
