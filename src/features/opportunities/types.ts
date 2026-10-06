import type {
  OpportunityLevel,
  OpportunityScoreResult,
  SampleConfidence,
} from "../../../supabase/functions/_shared/opportunity.ts";
import type { BusinessSearchResult } from "../search-leads/types";

export type OpportunitySampleSource =
  | "places-search"
  | "open-now"
  | "local-search";

export type OpportunitySample = {
  city: string;
  state: string;
  segment: string;
  checkedAt: string;
  results: BusinessSearchResult[];
  source: OpportunitySampleSource;
};

export type OpportunityStats = {
  sampleSize: number;
  withSiteCount: number;
  withoutSiteCount: number;
  withoutSiteRate: number;
  withPhoneCount: number;
  phoneRate: number;
  ratedCount: number;
  averageRating: number | null;
  reviewCountTotal: number;
  averageReviewCount: number;
  activeCount: number;
  withoutSiteWithPhoneCount: number;
  withoutSiteWithPhoneRate: number;
  withoutSiteWithPhoneRatedCount: number;
  activeWithoutSiteCount: number;
  lastObservedAt: string;
};

export type OpportunityRecord = OpportunityStats &
  OpportunityScoreResult & {
    key: string;
    city: string;
    state: string;
    segment: string;
    stale: boolean;
    businesses: BusinessSearchResult[];
    level: OpportunityLevel;
    sampleConfidence: SampleConfidence;
  };

export type OpportunitySummary = {
  cities: number;
  segments: number;
  uniqueBusinesses: number;
  withoutSiteBusinesses: number;
};

export type OpportunitySort =
  | "score"
  | "without-site"
  | "without-site-rate"
  | "sample"
  | "recent";
