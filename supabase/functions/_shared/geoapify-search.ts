import { findBrazilianState } from "./brazil-locations.ts";
import { geoapifyCategoryForSegment } from "./geoapify-niche-categories.ts";

/** Geoapify-only transport model, without any Google-derived fields. */
export type GeoapifyBusiness = {
  placeId: string;
  source: "geoapify";
  sourceUrl: string | null;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  internationalPhone: string | null;
  rating: null;
  reviewCount: null;
  isOpenNow: null;
  openingHours: string[];
  currentOpeningHours: null;
  regularOpeningHours: null;
  website: string | null;
  instagram: null;
  googleMapsUrl: null;
  businessStatus: null;
  latitude: number | null;
  longitude: number | null;
};
type GeoapifyPlace = {
  properties?: Record<string, unknown>;
  geometry?: { coordinates?: unknown };
};
type GeoResponse = { results?: Array<Record<string, unknown>> };
type PlacesResponse = { features?: GeoapifyPlace[] };

const PAGE_SIZE = 20;
const MAX_OFFSET = 80;
const GEOCODE_TIMEOUT_MS = 6500;
const PLACES_TIMEOUT_MS = 8000;
const locationCache = new Map<string, { id: string; expires: number }>();

function normalize(s: unknown) {
  return typeof s === "string"
    ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ")
    : "";
}
function str(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  return v.trim().slice(0, max) || null;
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? v as Record<string, unknown> : {};
}
function requiredLocation(city: string, state: string, candidate: Record<string,unknown>) {
  const code = normalize(candidate.state_code).replace(/^br-/, "");
  const stateName = findBrazilianState(state)?.name ?? "";
  const sameState = code === normalize(state) || normalize(candidate.state) === normalize(stateName);
  const name = normalize(candidate.city ?? candidate.name);
  return normalize(candidate.country_code) === "br" && sameState && name === normalize(city);
}
async function jsonWithinTimeout(url: URL, timeout: number): Promise<{ ok: boolean; status: number; value: unknown }> {
  // URL includes the API key; NEVER log or return the URL.
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) return { ok: false, status: response.status, value: null };
  const raw = await response.text();
  if (raw.length > 850_000) return { ok: false, status: 502, value: null };
  try {
    return { ok: true, status: 200, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, status: 502, value: null };
  }
}
type ReserveGeoCredit=(operation:"geocode"|"places")=>Promise<boolean>;
async function cityPlaceId(key: string, city: string, state: string,
  reserveCredit?: ReserveGeoCredit): Promise<string | null> {
  const identity = normalize(city) + ":" + state.toUpperCase();
  const cached = locationCache.get(identity);
  if (cached && cached.expires > Date.now()) return cached.id;
  const fullState = findBrazilianState(state)?.name;
  if (!fullState) return null;
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.search = new URLSearchParams({
    text: city + ", " + fullState + ", Brasil",
    type: "city", filter: "countrycode:br", lang: "pt",
    limit: "5", format: "json", apiKey: key,
  }).toString();
  // Claim a shared FREE-tier credit before any external geocoding request.
  // When the project pool is exhausted this provider fails closed.
  if (reserveCredit && !(await reserveCredit("geocode"))) return null;
  const response = await jsonWithinTimeout(url, GEOCODE_TIMEOUT_MS);
  if (!response.ok) return null;
  const results = record(response.value).results;
  if (!Array.isArray(results)) return null;
  for (const item of results) {
    const p = record(item);
    if (!requiredLocation(city, state, p)) continue;
    const id = str(p.place_id, 2048);
    if (!id) continue;
    if (locationCache.size > 120) locationCache.clear();
    locationCache.set(identity, { id, expires: Date.now() + 6 * 60 * 60_000 });
    return id;
  }
  return null;
}
function fromFeature(feature: GeoapifyPlace, city: string, state: string): GeoapifyBusiness | null {
  const p = record(feature.properties);
  const name = str(p.name, 160);
  if (!name) return null;
  // Geoapify already filters by city boundary. Reject named records from a
  // clearly different municipality or state when those fields are supplied.
  if (p.country_code && normalize(p.country_code) !== "br") return null;
  const recState = normalize(p.state_code).replace(/^br-/, "");
  if (recState && recState !== normalize(state)) return null;
  if (p.city && normalize(p.city) !== normalize(city)) return null;

  const sourceId = str(p.place_id, 512) ??
    (typeof p.osm_id === "number" && typeof p.osm_type === "string"
      ? p.osm_type + ":" + p.osm_id : null);
  if (!sourceId) return null;
  const contact = record(p.contact);
  const raw = record(record(p.datasource).raw);
  const phone = str(contact.phone, 80) ?? str(p.phone, 80) ??
    str(raw["contact:phone"], 80) ?? str(raw.phone, 80);
  const website = str(p.website, 600) ?? str(contact.website, 600) ??
    str(raw.website, 600);
  const coordinates = feature.geometry?.coordinates;
  const coordinate = Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates : null;
  const osmType = str(p.osm_type, 12);
  const osmId = typeof p.osm_id === "number" && Number.isInteger(p.osm_id) ? p.osm_id : null;
  const osmKind = osmType === "n" ? "node" : osmType === "w" ? "way" : osmType === "r" ? "relation" : "";
  const sourceUrl = osmKind && osmId && osmId > 0
    ? "https://www.openstreetmap.org/" + osmKind + "/" + osmId : null;
  const propsCategories = Array.isArray(p.categories)
    ? p.categories.filter((c): c is string => typeof c === "string").slice(0, 8) : [];
  return {
    placeId: "geoapify:" + sourceId,
    source: "geoapify",
    sourceUrl,
    name,
    primaryCategory: propsCategories[0] ?? null,
    categories: propsCategories,
    description: null,
    address: str(p.formatted, 300) ?? str(p.address_line1, 250),
    neighborhood: str(p.suburb, 120) ?? str(p.district, 120),
    city, state, phone, internationalPhone: null,
    rating: null, reviewCount: null,
    isOpenNow: null, openingHours: [],
    currentOpeningHours: null, regularOpeningHours: null,
    website, instagram: null, googleMapsUrl: null,
    businessStatus: null,
    latitude: coordinate ? num(coordinate[1]) : num(p.lat),
    longitude: coordinate ? num(coordinate[0]) : num(p.lon),
  };
}
export type GeoapifySearchOutcome =
  | { ok: true; results: GeoapifyBusiness[]; nextPageToken: string | null; rawCount: number }
  | { ok: false; reason: "NOT_CONFIGURED" | "UNSUPPORTED" | "GEOLOCATION" | "UPSTREAM" };

export async function searchGeoapifyFirst(input: {
  apiKey: string | null | undefined;
  segment: string; city: string; state: string;
  offset?: number;
  reserveCredit?: ReserveGeoCredit;
}): Promise<GeoapifySearchOutcome> {
  const key = input.apiKey?.trim();
  if (!key) return { ok: false, reason: "NOT_CONFIGURED" };
  const mapped = geoapifyCategoryForSegment(input.segment);
  if (!mapped) return { ok: false, reason: "UNSUPPORTED" };
  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET || offset % PAGE_SIZE !== 0)
    return { ok: false, reason: "UPSTREAM" };
  try {
    const placeId = await cityPlaceId(key, input.city, input.state, input.reserveCredit);
    if (!placeId) return { ok: false, reason: "GEOLOCATION" };
    const url = new URL("https://api.geoapify.com/v2/places");
    url.search = new URLSearchParams({
      categories: mapped.categories.join(","),
      filter: "place:" + placeId,
      lang: "pt", limit: String(PAGE_SIZE), offset: String(offset),
      apiKey: key,
    }).toString();
    if (input.reserveCredit && !(await input.reserveCredit("places")))
      return { ok:false, reason:"UPSTREAM" };
    const response = await jsonWithinTimeout(url, PLACES_TIMEOUT_MS);
    if (!response.ok) return { ok: false, reason: "UPSTREAM" };
    const rawFeatures = record(response.value).features;
    if (!Array.isArray(rawFeatures)) return { ok: false, reason: "UPSTREAM" };
    const results = rawFeatures
      .map(v=>fromFeature(record(v) as GeoapifyPlace, input.city, input.state))
      .filter((v): v is GeoapifyBusiness => Boolean(v))
      .filter(v=>!mapped.nameFilter || mapped.nameFilter.test(v.name));
    const deduped = Array.from(new Map(results.map(v=>[v.placeId,v])).values());
    return {
      ok: true, results: deduped, rawCount: rawFeatures.length,
      nextPageToken: rawFeatures.length === PAGE_SIZE && offset + PAGE_SIZE <= MAX_OFFSET
        ? "geoapify:" + (offset + PAGE_SIZE) : null,
    };
  } catch (error) {
    console.warn("[search-places] geoapify_search_unavailable",
      error instanceof Error ? error.name : "unknown");
    return { ok: false, reason: "UPSTREAM" };
  }
}

/** Contact-rich results avoid unnecessary Google calls, without user points. */
export function needsGoogleSupplement(results: readonly {
  name: string; phone: string | null; internationalPhone: string | null;
}[]): boolean {
  const contactable = results.filter(v=>{
    const digits = (v.phone || v.internationalPhone || "").replace(/\D/g,"");
    return digits.length >= 10 && digits.length <= 13;
  }).length;
  return results.length < 8 || contactable < 5;
}
