// Single source of truth for the niches selectable in Buscar Leads.
// The deterministic Niche Strategy backend imports the same catalog.
export {
  ALL_SEARCH_SEGMENTS,
  SEGMENT_GROUPS,
  normalizeSearchText,
  type SegmentGroup,
} from "../../../supabase/functions/_shared/niche-catalog.ts";
