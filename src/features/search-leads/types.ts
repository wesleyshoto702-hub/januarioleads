import type { SaasUsage } from "./saas-usage";
import type { OpeningHoursSnapshot } from "../../../supabase/functions/_shared/open-now.ts";
import type { InstagramCandidate, InstagramSource } from "../business-presence/types";
import type {
  DeepConfirmedChannels,
  DeepEnrichmentConfidence,
  DeepEnrichmentStatus,
  DeepVerifiedContent,
  DeepVerifiedImage,
} from "../business-enrichment/types";

export type BusinessSearchResult = {
  placeId: string;
  /** Server-verified same-day equivalent ID from another provider. Never stored as Google content. */
  equivalentPlaceId?: string | null;
  previewOnly?: boolean;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  internationalPhone: string | null;
  rating: number | null;
  reviewCount: number | null;
  isOpenNow: boolean | null;
  openingHours: string[];
  currentOpeningHours?: OpeningHoursSnapshot | null | undefined;
  regularOpeningHours?: OpeningHoursSnapshot | null | undefined;
  website: string | null;
  instagram: string | null;
  instagramConfidence?: "high" | "medium" | "low" | null | undefined;
  instagramSource?: InstagramSource | null | undefined;
  instagramCheckedAt?: string | null | undefined;
  instagramUsername?: string | null | undefined;
  instagramDisplayName?: string | null | undefined;
  instagramCandidates?: InstagramCandidate[] | null | undefined;
  instagramRejectedUrls?: string[] | null | undefined;
  instagramSearchSignature?: string | null | undefined;
  instagramSearchScope?: "site" | "web" | undefined;
  instagramNeedsReview?: boolean | null | undefined;
  factualDescription?: string | null | undefined;
  googleMapsUrl: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
  verifiedContent?: DeepVerifiedContent | null | undefined;
  verifiedImages?: DeepVerifiedImage[] | null | undefined;
  confirmedChannels?: DeepConfirmedChannels | null | undefined;
  deepEnrichmentStatus?: DeepEnrichmentStatus | null | undefined;
  deepEnrichmentQuality?: DeepEnrichmentConfidence | null | undefined;
  deepEnrichmentCheckedAt?: string | null | undefined;
};

export type SaasSearchQuota = {
  plan: "free" | "pro" | "advanced";
  daily_limit: number | null;
  used_today: number | null;
  remaining_today: number | null;
  usage_date: string;
  max_results: number;
  allowed: boolean;
  reset_at: string | null;
};

export type BusinessSearchSuccess = {
  ok: true;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
  /** Automatic provider pagination may stop early on API budget exhaustion. */
  partial?: boolean;
  creditCost?: number;
  creditsSpent?: number;
  quota?: SaasUsage;
  searchQuota?: SaasSearchQuota;
  demo?: boolean;
};

export type BusinessSearchFailure = {
  ok: false;
  code:
    | "NOT_CONFIGURED"
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "GOOGLE_AUTH"
    | "API_NOT_ENABLED"
    | "BILLING_REQUIRED"
    | "INVALID_REQUEST"
    | "QUOTA"
    | "DAILY_LEAD_LIMIT"
    | "DAILY_SEARCH_LIMIT"
    | "FREE_PAGE_LIMIT"
    | "FEATURE_NOT_AVAILABLE"
    | "REQUEST_FAILED";
  message: string;
  quota?: SaasUsage;
  searchQuota?: SaasSearchQuota;
};

export type BusinessSearchResponse = BusinessSearchSuccess | BusinessSearchFailure;
