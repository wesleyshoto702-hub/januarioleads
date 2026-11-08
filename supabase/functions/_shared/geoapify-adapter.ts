import { findBrazilianState } from "./brazil-locations.ts";

/** Explicit OSM categories: a niche without a reviewed mapping does not trigger a broad query. */
const SEGMENT_CATEGORIES: Record<string, string> = {
  barbearia: "service.beauty.hairdresser",
  "salao de beleza": "service.beauty.hairdresser",
  academia: "sport.fitness.gym",
  restaurante: "catering.restaurant",
  cafeteria: "catering.cafe",
  pizzaria: "catering.restaurant.pizza",
  spa: "service.beauty.spa",
  // Reviewed category keys from the official Geoapify Places taxonomy.
  // Ambiguous/specialized niches continue directly to Google Text Search.
  padaria: "commercial.food_and_drink.bakery",
  acougue: "commercial.food_and_drink.butcher",
  peixaria: "commercial.food_and_drink.seafood",
  hortifruti: "commercial.food_and_drink.fruit_and_vegetable",
  doceria: "commercial.food_and_drink.confectionery",
  sorveteria: "commercial.food_and_drink.ice_cream",
  floricultura: "commercial.florist",
  joalheria: "commercial.jewelry",
  "loja de roupas": "commercial.clothing.clothes",
  "loja de calcados": "commercial.clothing.shoes",
  "loja de moda infantil": "commercial.clothing.kids",
  "loja de bicicletas": "commercial.outdoor_and_sport.bicycle",
  "loja de presentes": "commercial.gift_and_souvenir",
  "loja de iluminacao": "commercial.furniture_and_interior.lighting",
  "loja de cortinas": "commercial.furniture_and_interior.curtain",
  "loja de produtos naturais": "commercial.food_and_drink.health_food",
  "loja agropecuaria": "commercial.agrarian",
  "pet shop": "pet.shop",
  "clinica veterinaria": "pet.veterinary",
  "hotel para pets": "pet.animal_boarding",
  hotel: "accommodation.hotel",
  hostel: "accommodation.hostel",
  "chales para temporada": "accommodation.chalet",
  pousada: "accommodation.guest_house",
  estacionamento: "parking.cars",
  "cartorio / servicos notariais": "office.notary",
  "escritorio de advocacia": "office.lawyer",
  "corretor de seguros": "office.insurance",
  "agencia de viagens": "office.travel_agent",
  transportadora: "office.logistics",
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

export function geoapifyCategoryForSegment(segment: string): string | null {
  return SEGMENT_CATEGORIES[normalize(segment)] ?? null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Avoid querying a homonymous city in another country or Brazilian state. */
export type GeoapifyCityLocation = { placeId: string; lon: number; lat: number };

/** Coordinates and boundary must come from the *same* validated city result. */
export function resolveGeoapifyCityLocation(
  geocodingGeoJson: unknown,
  city: string,
  stateCode: string,
): GeoapifyCityLocation | null {
  const envelope = record(geocodingGeoJson);
  const features = Array.isArray(envelope?.features) ? envelope.features : [];
  const state = findBrazilianState(stateCode);
  if (!state) return null;

  for (const feature of features) {
    const props = record(record(feature)?.properties);
    if (!props) continue;
    const country = stringField(props.country_code);
    const actualCity = stringField(props.city) ?? stringField(props.name);
    const actualState = stringField(props.state);
    const actualStateCode = stringField(props.state_code);
    const matchesState = Boolean(
      actualState && normalize(actualState) === normalize(state.name)
    ) || Boolean(
      actualStateCode && ["BR-" + state.code, state.code].includes(actualStateCode.toUpperCase())
    );
    const id = stringField(props.place_id);
    if (country?.toLowerCase() !== "br" || !actualCity ||
        normalize(actualCity) !== normalize(city) || !matchesState ||
        !id || !/^[a-zA-Z0-9]+$/.test(id)) continue;
    const geometry = record(record(feature)?.geometry);
    const coordinates = geometry?.coordinates;
    const lon = typeof props.lon === "number" ? props.lon
      : Array.isArray(coordinates) ? coordinates[0] : null;
    const lat = typeof props.lat === "number" ? props.lat
      : Array.isArray(coordinates) ? coordinates[1] : null;
    if (typeof lon !== "number" || typeof lat !== "number" ||
        !Number.isFinite(lon) || !Number.isFinite(lat) ||
        Math.abs(lon) > 180 || Math.abs(lat) > 90) continue;
    return { placeId: id, lon, lat };
  }
  return null;
}

/** Compatibility for consumers that only need the municipal boundary ID. */
export function resolveGeoapifyCityId(
  geocodingGeoJson: unknown,
  city: string,
  stateCode: string,
): string | null {
  return resolveGeoapifyCityLocation(geocodingGeoJson, city, stateCode)?.placeId ?? null;
}

/** Distinguish genuine Geoapify zero matches from an unexpected response schema. */
export function geoapifyFeatureCount(data: unknown): number | null {
  const payload = record(data);
  return Array.isArray(payload?.features) ? payload.features.length : null;
}

export type GeoapifyCoverageStatus =
  | "matches"
  | "no_osm_category_matches"
  | "unconfirmed_nearby";

/** A provider returning zero records must not be conflated with an API failure. */
export function classifyGeoapifyCoverage(
  resultCount: number,
  nearbyChecked: boolean,
): GeoapifyCoverageStatus {
  if (resultCount > 0) return "matches";
  return nearbyChecked ? "no_osm_category_matches" : "unconfirmed_nearby";
}

export type GeoapifyPlacePreview = {
  source: "geoapify";
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};

/** Provider provenance is retained. Never convert an OSM id into a Google Place ID. */
/** Geoapify groups all hairdressers under the same OSM category.
 * A barbershop query must not show unrelated salons as if they were barbers.
 * Ambiguous names go to the separate Google search instead of being mislabelled.
 */
export function filterGeoapifyForNiche(
  places: GeoapifyPlacePreview[], segment: string,
): GeoapifyPlacePreview[] {
  if (normalize(segment) !== "barbearia") return places;
  return places.filter((place) =>
    /\b(barbearia|barbeiro|barber|barbershop|barber shop)\b/.test(normalize(place.name))
  );
}

export function normalizeGeoapifyPlaces(
  data: unknown,
  location: { city: string; state: string },
): GeoapifyPlacePreview[] {
  const envelope = record(data);
  const features = Array.isArray(envelope?.features) ? envelope.features : [];
  const seen = new Set<string>();
  const output: GeoapifyPlacePreview[] = [];
  for (const feature of features) {
    const item = record(feature);
    const props = record(item?.properties);
    const geometry = record(item?.geometry);
    const coordinates = geometry?.coordinates;
    if (!props) continue;
    const name = stringField(props.name);
    const placeId = stringField(props.place_id);
    const lon = Array.isArray(coordinates) ? coordinates[0] : props.lon;
    const lat = Array.isArray(coordinates) ? coordinates[1] : props.lat;
    if (!name || !placeId || !/^[a-zA-Z0-9]+$/.test(placeId) ||
        typeof lat !== "number" || typeof lon !== "number" ||
        !Number.isFinite(lat) || !Number.isFinite(lon) ||
        Math.abs(lat) > 90 || Math.abs(lon) > 180 ||
        seen.has(placeId)) continue;
    // Radius searches near borders can include businesses beyond the chosen UF.
    // Keep valid nearby towns in the selected state, but not another state/country.
    const country = stringField(props.country_code);
    if (country && country.toLowerCase() !== "br") continue;
    const reportedCity = stringField(props.city);
    const reportedState =
      findBrazilianState(stringField(props.state_code)?.replace(/^BR-/i, "")) ??
      findBrazilianState(stringField(props.state));
    if (reportedState && reportedState.code !== location.state) continue;
    const address = stringField(props.formatted) ?? stringField(props.address_line1);
    seen.add(placeId);
    output.push({
      source: "geoapify",
      sourceId: "geoapify:" + placeId,
      name,
      category: Array.isArray(props.categories) &&
        typeof props.categories[0] === "string" ? props.categories[0] : null,
      address,
      city: reportedCity ?? location.city,
      state: reportedState?.code ?? location.state,
      latitude: lat,
      longitude: lon,
    });
    if (output.length >= 20) break;
  }
  return output;
}
