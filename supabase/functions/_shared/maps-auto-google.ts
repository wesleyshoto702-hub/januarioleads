import { findBrazilianState } from "./brazil-locations.ts";
import { resolveSearchSegment, searchTextForSegment } from "./niche-catalog.ts";
import { geoapifyCategoryForSegment } from "./geoapify-adapter.ts";

type GoogleAddressPart = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  formattedAddress?: string;
  addressComponents?: GoogleAddressPart[];
  googleMapsUri?: string;
  businessStatus?: string;
  location?: { latitude?: number; longitude?: number };
};

export type MapsGoogleBusiness = {
  placeId: string;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  description: null;
  address: string | null;
  neighborhood: null;
  city: string;
  state: string;
  phone: null;
  internationalPhone: null;
  rating: null;
  reviewCount: null;
  isOpenNow: null;
  openingHours: [];
  currentOpeningHours: null;
  regularOpeningHours: null;
  website: null;
  instagram: null;
  googleMapsUrl: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  previewOnly: true;
};

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ").trim();
}

function component(place: GooglePlace, type: string): GoogleAddressPart | null {
  return place.addressComponents?.find((item) =>
    Array.isArray(item.types) && item.types.includes(type)
  ) ?? null;
}

/** Strict municipality/state match prevents Google returning same-named businesses elsewhere. */
export function googlePlaceMatchesLocation(
  place: GooglePlace, city: string, stateCode: string,
): boolean {
  const state = findBrazilianState(stateCode);
  if (!state) return false;
  const expectedCity = fold(city);
  const formatted = fold(place.formattedAddress ?? "");
  const country = component(place,"country");
  const countryCode = string(country?.shortText) ?? string(country?.longText);
  // A BR region bias is not a hard country filter. Never return cross-border POIs.
  if (countryCode && !["br","brasil","brazil"].includes(fold(countryCode))) return false;

  const statePart = component(place,"administrative_area_level_1");
  const candidateState = findBrazilianState(
    string(statePart?.shortText) ?? string(statePart?.longText)
  );
  const stateMatches = candidateState
    ? candidateState.code === state.code
    : (" " + formatted + " ").includes(" " + fold(state.name) + " ") ||
      (" " + formatted + " ").includes(" " + fold(state.code) + " ");
  if (!stateMatches) return false;

  // In the Federal District, Brasília is the IBGE municipality but Google may
  // label an establishment's locality as Taguatinga, Gama or Ceilândia.
  if (state.code === "DF" && expectedCity === "brasilia") return true;

  // Google address components vary between regions. Compare every available
  // municipality-level component; don't let a neighborhood stand in for a city.
  const reportedCities = ["locality","postal_town","administrative_area_level_2"]
    .map((type) => string(component(place,type)?.longText))
    .filter((value): value is string => Boolean(value));
  if (reportedCities.length) {
    return reportedCities.some((value) => fold(value) === expectedCity);
  }
  // Some smaller municipalities have no locality components. Only then
  // use the address text, after verifying the requested UF above.
  return (" " + formatted + " ").includes(" " + expectedCity + " ");
}

export function normalizeGooglePreview(
  response: unknown, city: string, state: string,
): MapsGoogleBusiness[] | null {
  if (!response || typeof response !== "object") return null;
  const payload = response as { places?: unknown };
  if (payload.places !== undefined && !Array.isArray(payload.places)) return null;
  const places = payload.places ?? [];
  const seen = new Set<string>();
  const found: MapsGoogleBusiness[] = [];
  for (const place of places) {
    if (!place || typeof place !== "object") continue;
    const item = place as GooglePlace;
    const id = string(item.id);
    const name = string(item.displayName?.text);
    if (!id || !name || seen.has(id) ||
        !googlePlaceMatchesLocation(item,city,state)) continue;
    seen.add(id);
    const coords = item.location;
    const validLat = typeof coords?.latitude === "number" && Number.isFinite(coords.latitude) &&
      Math.abs(coords.latitude) <= 90;
    const validLon = typeof coords?.longitude === "number" && Number.isFinite(coords.longitude) &&
      Math.abs(coords.longitude) <= 180;
    found.push({
      placeId:id, name,
      primaryCategory:string(item.primaryTypeDisplayName?.text),
      categories:Array.isArray(item.types)?item.types.filter((x):x is string=>typeof x==="string"):[],
      description:null,
      address:string(item.formattedAddress), neighborhood:null,
      city,state,
      phone:null, internationalPhone:null, rating:null, reviewCount:null,
      isOpenNow:null,openingHours:[],currentOpeningHours:null,regularOpeningHours:null,
      website:null,instagram:null,googleMapsUrl:string(item.googleMapsUri),
      businessStatus:string(item.businessStatus),
      latitude:validLat?coords!.latitude!:null,
      longitude:validLon?coords!.longitude!:null,
      previewOnly:true,
    });
    if(found.length>=20)break;
  }
  return found;
}

export function mapsSearchTerm(segment: string): string | null {
  const canonical = resolveSearchSegment(segment);
  return canonical ? searchTextForSegment(canonical) ?? canonical : null;
}

export function shouldTryGeoapify(
  segment: string, neighborhood: string, geoConfigured: boolean,
): boolean {
  return geoConfigured && !neighborhood.trim() &&
    geoapifyCategoryForSegment(segment) !== null;
}

/** One request from the user; up to two providers with independent budgets. */
export function routingReason(
  geoAttempted: boolean,
  geoFound: boolean,
): "google_direct" | "google_fallback" | "geoapify" {
  if(!geoAttempted)return "google_direct";
  return geoFound?"geoapify":"google_fallback";
}
