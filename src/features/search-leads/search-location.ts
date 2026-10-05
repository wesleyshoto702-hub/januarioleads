import {
  makeLocationKey,
  normalizeLocationText,
  normalizeStateCode,
} from "../../lib/location";

export const SEARCH_STATE = {
  name: "Minas Gerais",
  code: "MG",
  ibgeCode: "31",
} as const;

export type SearchLocation = {
  city: string;
  state: typeof SEARCH_STATE.code;
};

export const DEFAULT_SEARCH_LOCATION: SearchLocation = {
  city: "Lavras",
  state: SEARCH_STATE.code,
};

const SEARCH_LOCATION_KEY = "leadflow:search-location";
const MUNICIPALITIES_CACHE_KEY = "leadflow:mg-municipalities:v1";
const MUNICIPALITIES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const IBGE_MUNICIPALITIES_URL =
  "https://servicodados.ibge.gov.br/api/v1/localidades/estados/31/municipios?orderBy=nome";

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

function readMunicipalityCache() {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      localStorage.getItem(MUNICIPALITIES_CACHE_KEY) ?? "null",
    ) as CachedMunicipalities | null;
    if (!parsed || typeof parsed.checkedAt !== "string") return null;
    const values = safeMunicipalities(parsed.values);
    if (!values.length) return null;
    return { ...parsed, values };
  } catch {
    return null;
  }
}

function writeMunicipalityCache(values: string[]) {
  if (typeof window === "undefined") return;
  const payload: CachedMunicipalities = {
    checkedAt: new Date().toISOString(),
    values,
  };
  localStorage.setItem(MUNICIPALITIES_CACHE_KEY, JSON.stringify(payload));
}

export async function loadMinasGeraisMunicipalities(signal?: AbortSignal) {
  const cached = readMunicipalityCache();
  const cacheAge = cached
    ? Date.now() - new Date(cached.checkedAt).getTime()
    : Number.POSITIVE_INFINITY;

  if (cached && Number.isFinite(cacheAge) && cacheAge < MUNICIPALITIES_CACHE_TTL_MS) {
    return cached.values;
  }

  try {
    const response = await fetch(IBGE_MUNICIPALITIES_URL, { signal });
    if (!response.ok) throw new Error("IBGE_REQUEST_FAILED");

    const payload = await response.json() as Array<{ nome?: unknown }>;
    const values = safeMunicipalities(
      payload.map((item) => item?.nome),
    );
    if (!values.length) throw new Error("IBGE_EMPTY_RESPONSE");

    writeMunicipalityCache(values);
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
      localStorage.getItem(SEARCH_LOCATION_KEY) ?? "null",
    ) as { city?: unknown; state?: unknown } | null;

    if (
      validCityName(value?.city) &&
      normalizeStateCode(
        typeof value?.state === "string" ? value.state : "",
      ) === SEARCH_STATE.code
    ) {
      return {
        city: value.city.trim(),
        state: SEARCH_STATE.code,
      };
    }
  } catch {
    // Keep the legacy Lavras default when the saved value is malformed.
  }

  return DEFAULT_SEARCH_LOCATION;
}

export function saveSearchLocation(location: SearchLocation) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SEARCH_LOCATION_KEY,
    JSON.stringify({
      city: location.city.trim(),
      state: SEARCH_STATE.code,
    }),
  );
}

export function searchLocationKey(location: SearchLocation) {
  return makeLocationKey(location.city, location.state);
}
