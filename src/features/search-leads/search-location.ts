import { accountLocalStorage } from "../../lib/account-storage";
import {
  DEFAULT_BRAZIL_STATE,
  findBrazilianState,
  normalizeBrazilianStateCode,
} from "../../lib/brazil-locations";
import type { BusinessSearchResult } from "./types";
import {
  makeLocationKey,
  normalizeLocationText,
} from "../../lib/location";

export type SearchLocation = {
  city: string;
  state: string;
};

/**
 * Search results can omit a locality in Google address components even when
 * the backend verified the result belongs to the requested city and UF.
 * Carry that verified search context into a newly saved lead.
 */
export function withSearchLocation(
  business: BusinessSearchResult,
  location: SearchLocation,
): BusinessSearchResult {
  const state =
    normalizeBrazilianStateCode(business.state) ||
    normalizeBrazilianStateCode(location.state);
  return {
    ...business,
    city: business.city?.trim() || location.city,
    state: state || null,
  };
}

export const DEFAULT_SEARCH_LOCATION: SearchLocation = {
  city: "Lavras",
  state: DEFAULT_BRAZIL_STATE.code,
};

const SEARCH_LOCATION_KEY = "leadflow:search-location";
const LEGACY_MG_MUNICIPALITIES_CACHE_KEY = "leadflow:mg-municipalities:v1";
const MUNICIPALITIES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CachedMunicipalities = {
  checkedAt: string;
  values: string[];
};

function validCityName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 2 &&
    value.trim().length <= 120
  );
}

function municipalityCacheKey(stateCode: string) {
  return `leadflow:municipalities:${stateCode}:v1`;
}

function safeMunicipalities(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  const unique = new Map<string, string>();
  for (const item of value) {
    if (!validCityName(item)) continue;
    const city = item.trim();
    unique.set(normalizeLocationText(city), city);
  }
  return Array.from(unique.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function parseMunicipalityCache(storageKey: string) {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      accountLocalStorage.getItem(storageKey) ?? "null",
    ) as CachedMunicipalities | null;
    if (!parsed || typeof parsed.checkedAt !== "string") return null;
    const values = safeMunicipalities(parsed.values);
    if (!values.length) return null;
    return { ...parsed, values };
  } catch {
    return null;
  }
}

function readMunicipalityCache(stateCode: string) {
  const current = parseMunicipalityCache(municipalityCacheKey(stateCode));
  if (current) return current;

  if (stateCode === "MG") {
    const legacy = parseMunicipalityCache(LEGACY_MG_MUNICIPALITIES_CACHE_KEY);
    if (legacy && typeof window !== "undefined") {
      accountLocalStorage.setItem(
        municipalityCacheKey(stateCode),
        JSON.stringify(legacy),
      );
    }
    return legacy;
  }

  return null;
}

function writeMunicipalityCache(stateCode: string, values: string[]) {
  if (typeof window === "undefined") return;
  const payload: CachedMunicipalities = {
    checkedAt: new Date().toISOString(),
    values,
  };
  accountLocalStorage.setItem(
    municipalityCacheKey(stateCode),
    JSON.stringify(payload),
  );
}

export async function loadBrazilianMunicipalities(
  stateCode: string,
  signal?: AbortSignal,
) {
  const state = findBrazilianState(stateCode);
  if (!state) throw new Error("INVALID_STATE");

  const cached = readMunicipalityCache(state.code);
  const cacheAge = cached
    ? Date.now() - new Date(cached.checkedAt).getTime()
    : Number.POSITIVE_INFINITY;

  if (
    cached &&
    Number.isFinite(cacheAge) &&
    cacheAge < MUNICIPALITIES_CACHE_TTL_MS
  ) {
    return cached.values;
  }

  try {
    const response = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state.ibgeCode}/municipios?orderBy=nome`,
      signal ? { signal } : {},
    );
    if (!response.ok) throw new Error("IBGE_REQUEST_FAILED");

    const payload = await response.json() as Array<{ nome?: unknown }>;
    const values = safeMunicipalities(payload.map((item) => item?.nome));
    if (!values.length) throw new Error("IBGE_EMPTY_RESPONSE");

    writeMunicipalityCache(state.code, values);
    return values;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    if (cached?.values.length) return cached.values;
    throw new Error("MUNICIPALITIES_UNAVAILABLE");
  }
}

export function resolveMunicipality(value: string, municipalities: string[]) {
  const normalized = normalizeLocationText(value);
  if (!normalized) return null;
  return (
    municipalities.find(
      (city) => normalizeLocationText(city) === normalized,
    ) ?? null
  );
}

export function loadSearchLocation(): SearchLocation {
  if (typeof window === "undefined") return DEFAULT_SEARCH_LOCATION;

  try {
    const value = JSON.parse(
      accountLocalStorage.getItem(SEARCH_LOCATION_KEY) ?? "null",
    ) as { city?: unknown; state?: unknown } | null;

    const state = normalizeBrazilianStateCode(
      typeof value?.state === "string" ? value.state : "",
    );

    if (validCityName(value?.city) && state) {
      return {
        city: value.city.trim(),
        state,
      };
    }
  } catch {
    // Keep the legacy Lavras/MG default when the saved value is malformed.
  }

  return DEFAULT_SEARCH_LOCATION;
}

export function saveSearchLocation(location: SearchLocation) {
  if (typeof window === "undefined") return;
  const state = normalizeBrazilianStateCode(location.state);
  if (!state || !validCityName(location.city)) return;

  accountLocalStorage.setItem(
    SEARCH_LOCATION_KEY,
    JSON.stringify({
      city: location.city.trim(),
      state,
    }),
  );
}

export function searchLocationKey(location: SearchLocation) {
  return makeLocationKey(location.city, location.state);
}
