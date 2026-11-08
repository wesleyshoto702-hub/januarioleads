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
    const address = stringField(props.formatted) ?? stringField(props.address_line1);
    seen.add(placeId);
    output.push({
      source: "geoapify",
      sourceId: "geoapify:" + placeId,
      name,
      category: Array.isArray(props.categories) &&
        typeof props.categories[0] === "string" ? props.categories[0] : null,
      address,
      city: location.city,
      state: location.state,
      latitude: lat,
      longitude: lon,
    });
    if (output.length >= 20) break;
  }
  return output;
}
