import { accountLocalStorage } from "../../lib/account-storage";
import { SAAS_STAGING_ACTIVE } from "../search-leads/saas-usage";
import {
  isOpenNowCacheFresh,
  type OpeningHoursSnapshot,
} from "../../../supabase/functions/_shared/open-now.ts";
import type { BusinessSearchResult } from "../search-leads/types";
import {
  makeLocationKey,
  normalizeLocationText,
  normalizeStateCode,
} from "../../lib/location";
import {
  DEFAULT_BRAZIL_STATE,
  normalizeBrazilianStateCode,
} from "../../lib/brazil-locations";

const PREFIX = "leadflow:open-now-search-cache:";
const LOCATION_KEY = "leadflow:open-now-location";

export type LocalOpenNowCache = {
  segment: string;
  city: string;
  state: string;
  checkedAt: string;
  results: BusinessSearchResult[];
};

function key(city: string, state: string, segment: string) {
  return `${PREFIX}${makeLocationKey(city, state)}|${normalizeLocationText(segment)}`;
}

function safeHours(value: unknown): OpeningHoursSnapshot | null {
  return value && typeof value === "object"
    ? value as OpeningHoursSnapshot
    : null;
}

function safeBusiness(value: unknown): BusinessSearchResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BusinessSearchResult>;
  if (!row.placeId || !row.name) return null;
  return {
    ...row,
    placeId: row.placeId,
    name: row.name,
    primaryCategory: row.primaryCategory ?? null,
    categories: Array.isArray(row.categories) ? row.categories : [],
    description: row.description ?? null,
    address: row.address ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    phone: row.phone ?? null,
    internationalPhone: row.internationalPhone ?? null,
    rating: typeof row.rating === "number" ? row.rating : null,
    reviewCount: typeof row.reviewCount === "number" ? row.reviewCount : null,
    isOpenNow: typeof row.isOpenNow === "boolean" ? row.isOpenNow : null,
    openingHours: Array.isArray(row.openingHours) ? row.openingHours : [],
    currentOpeningHours: safeHours(row.currentOpeningHours),
    regularOpeningHours: safeHours(row.regularOpeningHours),
    website: row.website ?? null,
    instagram: row.instagram ?? null,
    googleMapsUrl: row.googleMapsUrl ?? null,
    businessStatus: row.businessStatus ?? null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
  };
}

export function saveOpenNowLocation(city: string, state: string) {
  if (typeof window === "undefined") return;
  const normalizedState = normalizeBrazilianStateCode(state);
  if (!city.trim() || !normalizedState) return;
  accountLocalStorage.setItem(
    LOCATION_KEY,
    JSON.stringify({ city: city.trim(), state: normalizedState }),
  );
}

export function loadOpenNowLocation() {
  if (typeof window === "undefined") {
    return { city: "Lavras", state: DEFAULT_BRAZIL_STATE.code };
  }
  try {
    const value = JSON.parse(accountLocalStorage.getItem(LOCATION_KEY) ?? "null") as {
      city?: unknown;
      state?: unknown;
    } | null;
    const city =
      typeof value?.city === "string" && value.city.trim()
        ? value.city.trim()
        : "Lavras";
    const state =
      normalizeBrazilianStateCode(
        typeof value?.state === "string" ? value.state : "",
      ) || DEFAULT_BRAZIL_STATE.code;
    return { city, state };
  } catch {
    return { city: "Lavras", state: DEFAULT_BRAZIL_STATE.code };
  }
}

function clearOldStagingGoogleCaches(): void {
  if (!SAAS_STAGING_ACTIVE || typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < accountLocalStorage.length; i++) {
    const storageKey = accountLocalStorage.key(i);
    if (storageKey?.startsWith(PREFIX)) keys.push(storageKey);
  }
  for (const storageKey of keys) accountLocalStorage.removeItem(storageKey);
}

export function storeRecentBusinessSearch(
  segment: string,
  results: BusinessSearchResult[],
  options: {city:string;state:string;append?:boolean},
) {
  if (SAAS_STAGING_ACTIVE) {
    clearOldStagingGoogleCaches();
    return; // Staging: live results only, no persistent Places cache.
  }
  if (typeof window === "undefined") return;
  const storageKey = key(options.city,options.state,segment);
  let previous: LocalOpenNowCache | null = null;
  if (options.append) {
    try {
      previous = JSON.parse(
        accountLocalStorage.getItem(storageKey) ?? "null",
      ) as LocalOpenNowCache | null;
    } catch {
      previous = null;
    }

    if (!previous) {
      previous =
        loadRecentBusinessSearches(options.city, options.state).find(
          (item) =>
            normalizeLocationText(item.segment) ===
            normalizeLocationText(segment),
        ) ?? null;
    }
  }
  const combined = options.append && previous
    ? [...previous.results,...results]
    : results;
  const unique = new Map(combined.map((item)=>[item.placeId,item]));
  const cache: LocalOpenNowCache = {
    segment,
    city:options.city,
    state:options.state,
    checkedAt:new Date().toISOString(),
    results:Array.from(unique.values()).slice(0,60),
  };
  accountLocalStorage.setItem(storageKey,JSON.stringify(cache));
}

export function loadRecentBusinessSearches(city: string,state: string) {
  if (SAAS_STAGING_ACTIVE) {
    clearOldStagingGoogleCaches();
    return [] as LocalOpenNowCache[];
  }
  if (typeof window === "undefined") return [] as LocalOpenNowCache[];
  const values: LocalOpenNowCache[] = [];
  const expectedCity = normalizeLocationText(city);
  const expectedState = normalizeStateCode(state);

  for(let index=0;index<accountLocalStorage.length;index+=1){
    const storageKey=accountLocalStorage.key(index);
    if(!storageKey?.startsWith(PREFIX)) continue;
    try{
      const raw=JSON.parse(accountLocalStorage.getItem(storageKey) ?? "null") as LocalOpenNowCache | null;
      if(
        !raw ||
        normalizeLocationText(raw.city) !== expectedCity ||
        normalizeStateCode(raw.state) !== expectedState ||
        !isOpenNowCacheFresh(raw.checkedAt)
      ) continue;

      const results=(Array.isArray(raw.results)?raw.results:[])
        .map(safeBusiness)
        .filter((item):item is BusinessSearchResult=>Boolean(item));
      values.push({...raw,results});
    }catch{
      // Ignore malformed local cache entries.
    }
  }
  return values;
}


export function loadOpportunityBusinessSearches() {
  if (SAAS_STAGING_ACTIVE) {
    clearOldStagingGoogleCaches();
    return [] as LocalOpenNowCache[];
  }
  if (typeof window === "undefined") return [] as LocalOpenNowCache[];

  const values: LocalOpenNowCache[] = [];
  for (let index = 0; index < accountLocalStorage.length; index += 1) {
    const storageKey = accountLocalStorage.key(index);
    if (!storageKey?.startsWith(PREFIX)) continue;

    try {
      const raw = JSON.parse(
        accountLocalStorage.getItem(storageKey) ?? "null",
      ) as LocalOpenNowCache | null;
      if (
        !raw ||
        typeof raw.city !== "string" ||
        typeof raw.state !== "string" ||
        typeof raw.segment !== "string" ||
        typeof raw.checkedAt !== "string"
      ) {
        continue;
      }

      const checkedAt = new Date(raw.checkedAt).getTime();
      if (!Number.isFinite(checkedAt)) continue;

      const results = (Array.isArray(raw.results) ? raw.results : [])
        .map(safeBusiness)
        .filter((item): item is BusinessSearchResult => Boolean(item));

      values.push({
        ...raw,
        city: raw.city.trim(),
        state: normalizeStateCode(raw.state),
        segment: raw.segment.trim(),
        results,
      });
    } catch {
      // Ignore malformed legacy cache entries.
    }
  }

  return values;
}
