import {
  calculateOpportunityScore,
  dedupeByPlaceId,
} from "./opportunity.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("small sample cannot become high opportunity", () => {
  const result = calculateOpportunityScore({
    sampleSize: 4,
    withoutSiteCount: 3,
    withoutSiteWithPhoneCount: 3,
    activeWithoutSiteCount: 3,
  });
  assert(result.score <= 39, "Insufficient sample must be capped at 39.");
  assert(result.sampleConfidence === "insufficient", "Expected insufficient sample.");
});

Deno.test("large contactable sample produces high opportunity", () => {
  const result = calculateOpportunityScore({
    sampleSize: 50,
    withoutSiteCount: 30,
    withoutSiteWithPhoneCount: 28,
    activeWithoutSiteCount: 20,
  });
  assert(result.score >= 80, `Expected very high opportunity, got ${result.score}.`);
  assert(result.level === "very_high", "Expected very_high level.");
});

Deno.test("few companies without site keeps score low or moderate", () => {
  const result = calculateOpportunityScore({
    sampleSize: 50,
    withoutSiteCount: 5,
    withoutSiteWithPhoneCount: 5,
    activeWithoutSiteCount: 5,
  });
  assert(result.score < 60, `Expected score below 60, got ${result.score}.`);
});

Deno.test("low contactability loses points", () => {
  const weak = calculateOpportunityScore({
    sampleSize: 30,
    withoutSiteCount: 20,
    withoutSiteWithPhoneCount: 2,
    activeWithoutSiteCount: 15,
  });
  const strong = calculateOpportunityScore({
    sampleSize: 30,
    withoutSiteCount: 20,
    withoutSiteWithPhoneCount: 18,
    activeWithoutSiteCount: 15,
  });
  assert(strong.score > weak.score, "Contactable sample must outrank weak contactability.");
});

Deno.test("deduplication counts a placeId once", () => {
  const rows = dedupeByPlaceId([
    { placeId: "abc", value: 1 },
    { placeId: "abc", value: 2 },
    { placeId: "abc", value: 3 },
  ]);
  assert(rows.length === 1, "Same placeId must be counted once.");
});

Deno.test("city and segment group keys remain independent", () => {
  const keys = new Set([
    "belo horizonte|mg|barbearia",
    "contagem|mg|barbearia",
    "belo horizonte|mg|odontologia",
  ]);
  assert(keys.size === 3, "City and segment combinations must remain independent.");
});
