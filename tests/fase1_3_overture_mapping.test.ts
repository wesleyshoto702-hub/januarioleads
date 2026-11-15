import { ALL_SEARCH_SEGMENTS } from "../supabase/functions/_shared/niche-catalog.ts";
import {
  categoriesForOverture,
  OVERTURE_CATEGORIES,
  OVERTURE_CATEGORY_EXPANSIONS,
  OVERTURE_CATEGORY_PHASE13,
} from "../supabase/functions/_shared/overture-search.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// This JSON contains only aggregate category counts, no company contact information.
const fixture = JSON.parse(await Deno.readTextFile(
  new URL("./fixtures/fase1_3_overture_category_counts.json", import.meta.url)
)) as {meta: {total_records: number}; category_counts: Record<string, number>};

const countFor = (categories: readonly string[]) =>
  [...new Set(categories)].reduce((total, category) =>
    total + (fixture.category_counts[category] ?? 0), 0);

Deno.test("all 216 niches are inventoried, 125 old to 164 prepared", () => {
  assert(ALL_SEARCH_SEGMENTS.length === 216, "Unexpected change to catalog size");
  assert(new Set(ALL_SEARCH_SEGMENTS).size === 216, "Duplicate niche");
  const old = (niche: string) => [...new Set([
    ...(OVERTURE_CATEGORIES[niche] ?? []),
    ...(OVERTURE_CATEGORY_EXPANSIONS[niche] ?? []),
  ])];
  const oldMapped = ALL_SEARCH_SEGMENTS.filter(n => old(n).length);
  const newMapped = ALL_SEARCH_SEGMENTS.filter(n => categoriesForOverture(n).length);
  assert(oldMapped.length === 125, "Old mapping count should be 125");
  assert(newMapped.length === 164, "Prepared mapping count should be 164");
  assert(newMapped.length - oldMapped.length === 39, "Expected 39 newly mapped niches");
  const newlyMapped = ALL_SEARCH_SEGMENTS.filter(n =>
    !old(n).length && categoriesForOverture(n).length);
  assert(newlyMapped.length === 39, "Mapped an unexpected niche");
  const oldZero = ALL_SEARCH_SEGMENTS.filter(n =>
    old(n).length && countFor(old(n)) === 0);
  const recovered = oldZero.filter(n => countFor(categoriesForOverture(n)) > 0);
  assert(oldZero.length === 9 && recovered.length === 8,
    "Unexpected recovery of zero-result mappings");
  assert(ALL_SEARCH_SEGMENTS.filter(n =>
    categoriesForOverture(n).length && countFor(categoriesForOverture(n)) === 0
  ).length === 1, "Only Construtora should still have zero");
});

Deno.test("new mapping uses only new specific categories observed in STAGING", () => {
  const existing = new Set([
    ...Object.values(OVERTURE_CATEGORIES).flat(),
    ...Object.values(OVERTURE_CATEGORY_EXPANSIONS).flat(),
  ]);
  assert(Object.keys(OVERTURE_CATEGORY_PHASE13).length === 51,
    "Expected 51 deliberately reviewed mapping entries");
  const added = Object.values(OVERTURE_CATEGORY_PHASE13).flat();
  assert(new Set(added).size === 59, "Expected 59 distinct new categories");
  for (const [niche, categories] of Object.entries(OVERTURE_CATEGORY_PHASE13)) {
    assert(ALL_SEARCH_SEGMENTS.includes(niche), "Unknown canonical niche: " + niche);
    assert(categories.length > 0, "Empty mapping: " + niche);
    for (const category of categories) {
      assert(!existing.has(category), "Existing category duplicated: " + category);
      assert((fixture.category_counts[category] ?? 0) > 0,
        "Invented or absent category: " + category);
    }
  }
  assert(countFor(added) === 4291, "Expected 4,291 candidates newly addressable");
});

Deno.test("unique category coverage grows by 4,291 without importing records", () => {
  const original = [...new Set([
    ...Object.values(OVERTURE_CATEGORIES).flat(),
    ...Object.values(OVERTURE_CATEGORY_EXPANSIONS).flat(),
  ])];
  const prepared = [...new Set([
    ...original,
    ...Object.values(OVERTURE_CATEGORY_PHASE13).flat(),
  ])];
  assert(original.length === 187 && prepared.length === 246,
    "Category count regression");
  assert(countFor(original) === 194629, "Original mapped-row audit changed");
  assert(countFor(prepared) === 198920, "Prepared mapped-row audit changed");
  assert(fixture.meta.total_records === 321179,
    "This fixture is not for the same imported dataset");
});

Deno.test("avoid broad taxonomies, unrelated niches, false matches", () => {
  const forbidden = new Set([
    "school", "professional_service", "shopping", "education",
    "health_care", "medical_service_organization", "lodging",
    "travel_service", "party_and_event_planning", "animal_or_pet_service",
    "agricultural_service", "building_or_construction_service",
    "corporate_or_business_office", "food_and_drink", "automotive_service",
    "sports_and_recreation", "restaurant",
  ]);
  for (const cats of Object.values(OVERTURE_CATEGORY_PHASE13)) {
    for (const category of cats) {
      assert(!forbidden.has(category), "Broad taxonomy newly mapped: " + category);
    }
  }
  assert(categoriesForOverture("Açaiteria").length === 0,
    "Never map Açaiteria to an unrelated generic category");
  assert(categoriesForOverture("Construtora").length === 1 &&
    countFor(categoriesForOverture("Construtora")) === 0,
    "Do not fake positive coverage for Construtora");
  assert(categoriesForOverture("Barbearia").join(",") === "barber",
    "Unrelated barber category added");
  assert(categoriesForOverture("Chaveiro").includes("key_and_locksmith"),
    "Expected locksmith alias missing");
  assert(categoriesForOverture("Locadora de Veículos").includes("car_rental_service"),
    "Expected car-rental alias missing");
  assert(categoriesForOverture("Restaurante Japonês").includes("japanese_restaurant"),
    "Japanese restaurants should remain specialty-specific");
});
