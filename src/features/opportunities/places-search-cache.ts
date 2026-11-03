import { getValidSession } from "../../lib/auth";
import { searchLocationKey, type SearchLocation } from "../search-leads/search-location";
import type { BusinessSearchResult } from "../search-leads/types";
import { safeBusinessResult } from "./opportunity-businesses";
import type { OpportunitySample } from "./types";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";

type RemotePlacesSearchCache = {
  city: string;
  state: string;
  segment: string;
  checked_at: string;
  next_page_token: string | null;
  page_count: number;
  results: unknown;
};

export async function opportunityAuthedRequest(path: string, init: RequestInit = {}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function safeResults(value: unknown) {
  if (!Array.isArray(value)) return [] as BusinessSearchResult[];
  return value
    .map(safeBusinessResult)
    .filter((item): item is BusinessSearchResult => Boolean(item));
}

export async function fetchPlacesSearchSamples(): Promise<OpportunitySample[]> {
  const params = new URLSearchParams();
  params.set("select", "city,state,segment,checked_at,next_page_token,page_count,results");
  params.set("order", "checked_at.desc");

  const response = await opportunityAuthedRequest(`places_search_cache?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`PLACES_SEARCH_CACHE_${response.status}`);
  }

  return ((await response.json()) as RemotePlacesSearchCache[])
    .map((row): OpportunitySample => ({
      city: row.city,
      state: row.state,
      segment: row.segment,
      checkedAt: row.checked_at,
      results: safeResults(row.results),
      source: "places-search",
    }))
    .filter((row) => Boolean(row.checkedAt));
}

export type CachedPlacesSearchSample = {
  city: string;
  state: string;
  segment: string;
  checkedAt: string;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
  pageCount: number;
};

export async function fetchRecentPlacesSearchSamples(
  limit = 5,
): Promise<CachedPlacesSearchSample[]> {
  const params = new URLSearchParams();
  params.set("select", "city,state,segment,checked_at,next_page_token,page_count,results");
  params.set("order", "checked_at.desc");
  params.set("limit", String(Math.max(1, Math.min(20, limit))));

  const response = await opportunityAuthedRequest(`places_search_cache?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`PLACES_SEARCH_CACHE_RECENT_${response.status}`);
  }

  return ((await response.json()) as RemotePlacesSearchCache[])
    .map((row): CachedPlacesSearchSample => ({
      city: row.city,
      state: row.state,
      segment: row.segment,
      checkedAt: row.checked_at,
      results: safeResults(row.results),
      nextPageToken: row.next_page_token,
      pageCount: row.page_count,
    }))
    .filter(
      (row) => Boolean(row.checkedAt) && Boolean(row.city.trim()) && Boolean(row.segment.trim()),
    );
}

async function fetchExistingSample(userId: string, locationKey: string, segment: string) {
  const params = new URLSearchParams();
  params.set("select", "city,state,segment,checked_at,next_page_token,page_count,results");
  params.set("user_id", `eq.${userId}`);
  params.set("location_key", `eq.${locationKey}`);
  params.set("segment", `eq.${segment}`);
  params.set("limit", "1");

  const response = await opportunityAuthedRequest(`places_search_cache?${params.toString()}`);
  if (!response.ok) return null;

  const rows = (await response.json()) as RemotePlacesSearchCache[];
  return rows[0] ?? null;
}

export async function fetchCachedPlacesSearchSample(
  location: SearchLocation,
  segment: string,
): Promise<CachedPlacesSearchSample | null> {
  const session = await getValidSession();
  if (!session) return null;

  const row = await fetchExistingSample(session.user.id, searchLocationKey(location), segment);
  if (!row) return null;

  const results = safeResults(row.results);
  if (!results.length) return null;

  return {
    city: row.city,
    state: row.state,
    segment: row.segment,
    checkedAt: row.checked_at,
    results,
    nextPageToken: row.next_page_token,
    pageCount: row.page_count,
  };
}

export async function persistPlacesSearchSample(input: {
  location: SearchLocation;
  segment: string;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
  append: boolean;
}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  const locationKey = searchLocationKey(input.location);
  const previous = input.append
    ? await fetchExistingSample(session.user.id, locationKey, input.segment)
    : null;
  const previousResults = previous ? safeResults(previous.results) : [];
  const combined = input.append ? [...previousResults, ...input.results] : input.results;

  const unique = new Map<string, BusinessSearchResult>();
  for (const business of combined) {
    if (!business.placeId) continue;
    unique.set(business.placeId, business);
  }

  const now = new Date().toISOString();
  const response = await opportunityAuthedRequest(
    "places_search_cache?on_conflict=user_id,location_key,segment",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        location_key: locationKey,
        city: input.location.city,
        state: input.location.state,
        segment: input.segment,
        checked_at: now,
        next_page_token: input.nextPageToken,
        page_count: input.append ? Math.max(1, previous?.page_count ?? 1) + 1 : 1,
        results: Array.from(unique.values()).slice(0, 60),
        updated_at: now,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`PLACES_SEARCH_CACHE_SAVE_${response.status}`);
  }

  return true;
}
