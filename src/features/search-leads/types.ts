import type { InstagramCandidate, InstagramSource } from "../business-presence/types";

export type BusinessSearchResult = {
  placeId: string;
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
  website: string | null;
  instagram: string | null;
  instagramConfidence?: "high" | "medium" | "low" | null;
  instagramSource?: InstagramSource | null;
  instagramCheckedAt?: string | null;
  instagramUsername?: string | null;
  instagramCandidates?: InstagramCandidate[] | null;
  instagramRejectedUrls?: string[] | null;
  instagramSearchSignature?: string | null;
  instagramNeedsReview?: boolean | null;
  factualDescription?: string | null;
  googleMapsUrl: string | null;
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type BusinessSearchSuccess = {
  ok: true;
  results: BusinessSearchResult[];
  nextPageToken: string | null;
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
