import type { BusinessSearchFailure, BusinessSearchResult } from "../search-leads/types";

export type InstagramConfidence = "high" | "medium" | "low";
export type InstagramSource =
  | "google_places"
  | "official_website"
  | "web_search"
  | "manual_confirmation"
  | "existing_data";

export type InstagramCandidate = {
  url: string;
  username: string;
  displayName?: string | null;
  confidence: "medium" | "low";
  score: number;
  signals: string[];
  evidenceUrls: string[];
};

export type BusinessPresence = {
  instagramUrl: string | null;
  instagramUsername: string | null;
  instagramDisplayName?: string | null;
  instagramConfidence: InstagramConfidence | null;
  instagramSource: InstagramSource | null;
  instagramCheckedAt: string;
  instagramCandidates: InstagramCandidate[];
  instagramRejectedUrls: string[];
  instagramSearchSignature: string | null;
  instagramSearchScope?: "site" | "web";
  instagramNeedsReview: boolean;
};

export type PresenceDiscoverySuccess = {
  ok: true;
  mode: "presence-discovery";
  presence: BusinessPresence;
};

export type PresenceDiscoveryResponse =
  | PresenceDiscoverySuccess
  | BusinessSearchFailure;

export type PresenceBusiness = Pick<
  BusinessSearchResult,
  | "placeId"
  | "name"
  | "website"
  | "instagram"
  | "phone"
  | "internationalPhone"
  | "address"
  | "city"
  | "state"
  | "primaryCategory"
> & {
  instagramConfidence?: InstagramConfidence | null;
  instagramSource?: InstagramSource | null;
  instagramCheckedAt?: string | null;
  instagramUsername?: string | null;
  instagramDisplayName?: string | null;
  instagramCandidates?: InstagramCandidate[] | null;
  instagramRejectedUrls?: string[] | null;
  instagramSearchSignature?: string | null;
  instagramSearchScope?: "site" | "web";
  instagramNeedsReview?: boolean | null;
};
