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
  /** Provenance must remain attached to each provider's entire result. */
  source?: "google_places" | "geoapify" | "overture";
  /** Optional Geoapify/OSM feature source; never a Google Maps URL. */
  sourceUrl?: string | null;
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
  email?: string | null;
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

export type BusinessSearchSuccess = {
  ok: true;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
  provider?: "geoapify" | "google_places" | "overture" | "mixed";
  providerNotice?: string;
  /** Server-controlled switch: true only with Outscraper key, explicit opt-in and budgets. */
  outscraperAutoEnabled?: boolean;
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
    | "REQUEST_FAILED";
  message: string;
};

export type BusinessSearchResponse = BusinessSearchSuccess | BusinessSearchFailure;
