import {
  hasIdentifiedWebsite,
  mergeOpportunityBusinesses,
  opportunityGroupKey,
} from "../../../src/features/opportunities/opportunity-businesses.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function business(
  placeId: string,
  patch: Record<string, unknown> = {},
) {
  return {
    placeId,
    name: "Empresa teste",
    primaryCategory: null,
    categories: [],
    description: null,
    address: "Rua A, 10",
    neighborhood: null,
    city: "Belo Horizonte",
    state: "MG",
    phone: null,
    internationalPhone: null,
    rating: null,
    reviewCount: null,
    isOpenNow: null,
    openingHours: [],
    website: null,
    instagram: null,
    googleMapsUrl: null,
    businessStatus: "OPERATIONAL",
    latitude: null,
    longitude: null,
    ...patch,
  } as any;
}

Deno.test("three observations with same placeId become one business", () => {
  const merged = mergeOpportunityBusinesses(
    [
      { business: business("abc"), observedAt: "2026-10-01T12:00:00Z", source: "places-search" },
      { business: business("abc"), observedAt: "2026-10-02T12:00:00Z", source: "open-now" },
      { business: business("abc"), observedAt: "2026-10-03T12:00:00Z", source: "local-search" },
    ],
    [],
  );
  assert(merged.length === 1, "Same placeId must produce one business.");
});

Deno.test("identified website survives merge when another source omits it", () => {
  const merged = mergeOpportunityBusinesses(
    [
      {
        business: business("abc", { website: null }),
        observedAt: "2026-10-03T12:00:00Z",
        source: "open-now",
      },
      {
        business: business("abc", { website: "https://example.com" }),
        observedAt: "2026-10-02T12:00:00Z",
        source: "places-search",
      },
    ],
    [],
  );
  assert(
    hasIdentifiedWebsite(merged[0]!),
    "A known website must prevent false no-site classification.",
  );
});

Deno.test("city and segment combinations produce independent group keys", () => {
  const bhBarber = opportunityGroupKey("Belo Horizonte", "MG", "Barbearia");
  const contagemBarber = opportunityGroupKey("Contagem", "MG", "Barbearia");
  const bhDentist = opportunityGroupKey("Belo Horizonte", "MG", "Odontologia");

  assert(bhBarber !== contagemBarber, "Different cities must not mix.");
  assert(bhBarber !== bhDentist, "Different segments must not mix.");
});
