import type { BusinessSearchFailure, BusinessSearchResult } from "../search-leads/types";

export type InstagramConfidence = "high" | "medium" | "low";
export type InstagramSource =
  | "google_places"
  | "official_website"
  | "web_search";

export type BusinessPresence = {
  instagramUrl: string | null;
  instagramConfidence: InstagramConfidence | null;
  instagramSource: InstagramSource | null;
  instagramCheckedAt: string;
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
};
