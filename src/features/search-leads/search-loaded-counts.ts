/** Every number here refers ONLY to already-loaded search results.
 * Never infer citywide coverage or validity of external contact channels.
 */
import { matchesResultFilters, type ResultFilterState, type LeadStatusFilter,
  type ResultWithContext } from "./search-result-filters.ts";

export type SearchDisplayMode = "all" | "open";

export function countLoadedMatches(
  loaded: readonly ResultWithContext[],
  filters: ResultFilterState,
  status: LeadStatusFilter,
  mode: SearchDisplayMode,
): number {
  return loaded.filter(item =>
    (mode !== "open" || item.business.isOpenNow === true) &&
    matchesResultFilters(item, filters, status)
  ).length;
}

export function summarizeLoadedSearchResults(
  loaded: readonly ResultWithContext[],
  visibleCount: number,
) {
  const savedCount = loaded.filter(item => item.alreadyAdded).length;
  return {
    loadedCount: loaded.length,
    displayedCount: visibleCount,
    savedCount,
    newCount: loaded.length - savedCount,
    openCount: loaded.filter(item => item.business.isOpenNow === true).length,
    unknownHoursCount: loaded.filter(item => item.business.isOpenNow === null).length,
  };
}
