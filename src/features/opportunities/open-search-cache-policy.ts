/** Strict open-source-only cache policy shared by storage and Buscar Leads.
 * A cached result is a dated snapshot, never a live/verified business.
 */
import type { BusinessSearchResult } from "../search-leads/types.ts";
import type { SearchLocation } from "../search-leads/search-location.ts";
import { makeLocationKey } from "../../lib/location.ts";
import { resolveSearchSegment } from "../search-leads/segments.ts";
import { safeOpenContinuationToken } from "../../../supabase/functions/_shared/search-continuation.ts";

export const MAX_CACHED_SEARCH_RESULTS=60;
export type OpenSearchCacheSnapshot = {
  city:string;
  state:string;
  segment:string;
  checkedAt:string;
  results:BusinessSearchResult[];
  nextPageToken:string|null;
  pageCount:number;
};
export function onlyOpenSourceSearchResults(
  results:readonly BusinessSearchResult[],
):BusinessSearchResult[] {
  const unique=new Map<string,BusinessSearchResult>();
  for(const result of results) {
    if(!result || typeof result.placeId!=="string")continue;
    const overture=result.source==="overture" && result.placeId.startsWith("overture:");
    const geoapify=result.source==="geoapify" && result.placeId.startsWith("geoapify:");
    if((overture||geoapify) && result.name?.trim()) unique.set(result.placeId,result);
  }
  return [...unique.values()];
}
export function openCachePage(
  results:readonly BusinessSearchResult[],
  nextPageToken:unknown,
):{results:BusinessSearchResult[];nextPageToken:string|null} {
  const open=onlyOpenSourceSearchResults(results);
  return {
    results:open.slice(0,MAX_CACHED_SEARCH_RESULTS),
    // Never offer to skip data that could not fit in the cached snapshot.
    nextPageToken:open.length>MAX_CACHED_SEARCH_RESULTS
      ? null :safeOpenContinuationToken(nextPageToken),
  };
}
/** Verify row matches the exact search and contains a parseable timestamp.
 * Cache recovery must not surface mismatched cities or unrelated niches. */
export function eligibleQuotaCache(
  sample:OpenSearchCacheSnapshot|null,
  location:SearchLocation,
  segment:string,
):OpenSearchCacheSnapshot|null {
  if(!sample) return null;
  const sameCity=makeLocationKey(sample.city,sample.state)===
    makeLocationKey(location.city,location.state);
  const sameNiche=(resolveSearchSegment(sample.segment)??sample.segment)===
    (resolveSearchSegment(segment)??segment);
  const date=Date.parse(sample.checkedAt);
  if(!sameCity||!sameNiche||!Number.isFinite(date))return null;
  const open=openCachePage(sample.results,null).results;
  if(!open.length)return null;
  return {...sample,results:open,nextPageToken:null};
}
