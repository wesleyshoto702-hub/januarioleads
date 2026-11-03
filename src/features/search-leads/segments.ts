// Single source of truth for the niches selectable in Buscar Leads.
export {
  ALL_SEARCH_SEGMENTS,
  SEGMENT_GROUPS,
  normalizeSearchText,
  resolveSearchSegment,
  searchSegmentMatchesQuery,
  searchTextForSegment,
  SEARCH_SEGMENT_ALIASES,
  type SegmentGroup,
} from "../../../supabase/functions/_shared/niche-catalog.ts";
