import type {
  OpenNowEvaluation,
  OpeningHoursSnapshot,
} from "../../../supabase/functions/_shared/open-now.ts";
import type { BusinessSearchResult } from "../search-leads/types";

export type OpenNowNicheStatus =
  | "open_results"
  | "no_open_results"
  | "not_checked"
  | "checking"
  | "error";

export type OpenNowBusiness = BusinessSearchResult & {
  currentOpeningHours?: OpeningHoursSnapshot | null;
  regularOpeningHours?: OpeningHoursSnapshot | null;
  openNow?: OpenNowEvaluation;
};

export type OpenNowNicheCache = {
  segment: string;
  family: string;
  city: string;
  state: string;
  status: OpenNowNicheStatus;
  checkedAt: string | null;
  expiresAt: string | null;
  nextPageToken: string | null;
  pageCount: number;
  requestCount: number;
  results: OpenNowBusiness[];
  errorCode: string | null;
  errorMessage: string | null;
  stale: boolean;
  local?: boolean;
};

export type OpenNowCacheResponse =
  | {
      ok: true;
      city: string;
      state: string;
      timeZone: "America/Sao_Paulo";
      cacheTtlMinutes: number;
      niches: OpenNowNicheCache[];
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export type OpenNowRefreshResponse =
  | {
      ok: true;
      cached: boolean;
      googleRequests?: number;
      cache: OpenNowNicheCache;
    }
  | {
      ok: false;
      code: string;
      message: string;
      cache?: OpenNowNicheCache;
    };
