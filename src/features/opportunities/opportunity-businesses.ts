import { normalizeLocationText, normalizeStateCode } from "../../lib/location";
import type { PersistedLead } from "../leads/remote-leads";
import type { BusinessSearchResult } from "../search-leads/types";
import type { OpportunitySample } from "./types";

export type OpportunityObservation = {
  business: BusinessSearchResult;
  observedAt: string;
  source: OpportunitySample["source"];
};

function presentText(value: string | null | undefined) {
  return typeof value === "string" && Boolean(value.trim());
}

export function hasIdentifiedWebsite(
  business: Pick<BusinessSearchResult, "website">,
) {
  if (!presentText(business.website)) return false;
  const raw = business.website!.trim();
  try {
    const url = new URL(
      /^https?:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function hasBusinessPhone(
  business: Pick<BusinessSearchResult, "phone" | "internationalPhone">,
) {
  return presentText(business.phone) || presentText(business.internationalPhone);
}

export function hasStableActivitySignal(
  business: Pick<BusinessSearchResult, "businessStatus" | "reviewCount">,
) {
  return (
    business.businessStatus === "OPERATIONAL" ||
    (business.reviewCount ?? 0) >= 5
  );
}

export function safeBusinessResult(value: unknown): BusinessSearchResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BusinessSearchResult>;
  if (!presentText(row.placeId) || !presentText(row.name)) return null;

  return {
    placeId: row.placeId!,
    name: row.name!,
    primaryCategory: row.primaryCategory ?? null,
    categories: Array.isArray(row.categories) ? row.categories : [],
    description: row.description ?? null,
    address: row.address ?? null,
    neighborhood: row.neighborhood ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    phone: row.phone ?? null,
    internationalPhone: row.internationalPhone ?? null,
    rating: typeof row.rating === "number" ? row.rating : null,
    reviewCount: typeof row.reviewCount === "number" ? row.reviewCount : null,
    isOpenNow: typeof row.isOpenNow === "boolean" ? row.isOpenNow : null,
    openingHours: Array.isArray(row.openingHours) ? row.openingHours : [],
    currentOpeningHours: row.currentOpeningHours ?? null,
    regularOpeningHours: row.regularOpeningHours ?? null,
    website: row.website ?? null,
    instagram: row.instagram ?? null,
    instagramConfidence: row.instagramConfidence ?? null,
    instagramSource: row.instagramSource ?? null,
    instagramCheckedAt: row.instagramCheckedAt ?? null,
    instagramUsername: row.instagramUsername ?? null,
    instagramCandidates: Array.isArray(row.instagramCandidates)
      ? row.instagramCandidates
      : [],
    instagramRejectedUrls: Array.isArray(row.instagramRejectedUrls)
      ? row.instagramRejectedUrls
      : [],
    instagramSearchSignature: row.instagramSearchSignature ?? null,
    instagramNeedsReview: row.instagramNeedsReview ?? false,
    factualDescription: row.factualDescription ?? null,
    googleMapsUrl: row.googleMapsUrl ?? null,
    businessStatus: row.businessStatus ?? null,
    latitude: typeof row.latitude === "number" ? row.latitude : null,
    longitude: typeof row.longitude === "number" ? row.longitude : null,
    verifiedContent: row.verifiedContent ?? null,
    verifiedImages: Array.isArray(row.verifiedImages) ? row.verifiedImages : [],
    confirmedChannels: row.confirmedChannels ?? null,
    deepEnrichmentStatus: row.deepEnrichmentStatus ?? null,
    deepEnrichmentQuality: row.deepEnrichmentQuality ?? null,
    deepEnrichmentCheckedAt: row.deepEnrichmentCheckedAt ?? null,
  };
}

function preferText(
  current: string | null | undefined,
  fallback: string | null | undefined,
) {
  return presentText(current) ? current! : fallback ?? null;
}

function mergeBusiness(
  current: BusinessSearchResult,
  fallback: BusinessSearchResult,
): BusinessSearchResult {
  return {
    ...fallback,
    ...current,
    name: preferText(current.name, fallback.name) ?? current.name,
    primaryCategory: preferText(
      current.primaryCategory,
      fallback.primaryCategory,
    ),
    categories:
      current.categories.length > 0 ? current.categories : fallback.categories,
    description: preferText(current.description, fallback.description),
    address: preferText(current.address, fallback.address),
    neighborhood: preferText(current.neighborhood, fallback.neighborhood),
    city: preferText(current.city, fallback.city),
    state: preferText(current.state, fallback.state),
    phone: preferText(current.phone, fallback.phone),
    internationalPhone: preferText(
      current.internationalPhone,
      fallback.internationalPhone,
    ),
    rating: current.rating ?? fallback.rating,
    reviewCount: current.reviewCount ?? fallback.reviewCount,
    isOpenNow: current.isOpenNow ?? fallback.isOpenNow,
    openingHours:
      current.openingHours.length > 0
        ? current.openingHours
        : fallback.openingHours,
    currentOpeningHours:
      current.currentOpeningHours ?? fallback.currentOpeningHours ?? null,
    regularOpeningHours:
      current.regularOpeningHours ?? fallback.regularOpeningHours ?? null,
    website: hasIdentifiedWebsite(current)
      ? current.website
      : hasIdentifiedWebsite(fallback)
        ? fallback.website
        : current.website ?? fallback.website ?? null,
    instagram: preferText(current.instagram, fallback.instagram),
    googleMapsUrl: preferText(current.googleMapsUrl, fallback.googleMapsUrl),
    businessStatus: preferText(
      current.businessStatus,
      fallback.businessStatus,
    ),
    latitude: current.latitude ?? fallback.latitude,
    longitude: current.longitude ?? fallback.longitude,
    factualDescription: preferText(
      current.factualDescription,
      fallback.factualDescription,
    ),
    verifiedContent: current.verifiedContent ?? fallback.verifiedContent ?? null,
    verifiedImages:
      (current.verifiedImages?.length ?? 0) > 0
        ? current.verifiedImages!
        : fallback.verifiedImages ?? [],
    confirmedChannels:
      current.confirmedChannels ?? fallback.confirmedChannels ?? null,
  };
}

function leadAsBusinessPatch(
  lead: PersistedLead,
  fallback: BusinessSearchResult,
): BusinessSearchResult {
  return {
    ...fallback,
    name: lead.company || fallback.name,
    placeId: lead.placeId || fallback.placeId,
    primaryCategory: lead.primaryCategory ?? fallback.primaryCategory,
    categories: lead.categories ?? fallback.categories,
    description: lead.description ?? fallback.description,
    address: lead.address ?? fallback.address,
    neighborhood: lead.neighborhood ?? fallback.neighborhood,
    city: lead.city ?? fallback.city,
    state: lead.state ?? fallback.state,
    phone: lead.phone || fallback.phone,
    internationalPhone: lead.internationalPhone ?? fallback.internationalPhone,
    rating: lead.rating ?? fallback.rating,
    reviewCount: lead.reviewCount ?? fallback.reviewCount,
    isOpenNow: lead.isOpenNow ?? fallback.isOpenNow,
    openingHours: lead.openingHours ?? fallback.openingHours,
    website: lead.website ?? fallback.website,
    instagram: lead.instagram ?? fallback.instagram,
    instagramConfidence:
      lead.instagramConfidence ?? fallback.instagramConfidence ?? null,
    instagramSource: lead.instagramSource ?? fallback.instagramSource ?? null,
    instagramCheckedAt:
      lead.instagramCheckedAt ?? fallback.instagramCheckedAt ?? null,
    instagramUsername:
      lead.instagramUsername ?? fallback.instagramUsername ?? null,
    instagramCandidates:
      lead.instagramCandidates ?? fallback.instagramCandidates ?? [],
    instagramRejectedUrls:
      lead.instagramRejectedUrls ?? fallback.instagramRejectedUrls ?? [],
    instagramSearchSignature:
      lead.instagramSearchSignature ?? fallback.instagramSearchSignature ?? null,
    instagramNeedsReview:
      lead.instagramNeedsReview ?? fallback.instagramNeedsReview ?? false,
    factualDescription:
      lead.factualDescription ?? fallback.factualDescription ?? null,
    googleMapsUrl: lead.googleMapsUrl ?? fallback.googleMapsUrl,
    businessStatus: lead.businessStatus ?? fallback.businessStatus,
    latitude: lead.latitude ?? fallback.latitude,
    longitude: lead.longitude ?? fallback.longitude,
    verifiedContent:
      lead.verifiedContent ?? fallback.verifiedContent ?? null,
    verifiedImages:
      lead.verifiedImages ?? fallback.verifiedImages ?? [],
    confirmedChannels:
      lead.confirmedChannels ?? fallback.confirmedChannels ?? null,
    deepEnrichmentStatus:
      lead.deepEnrichmentStatus ?? fallback.deepEnrichmentStatus ?? null,
    deepEnrichmentQuality:
      lead.deepEnrichmentQuality ?? fallback.deepEnrichmentQuality ?? null,
    deepEnrichmentCheckedAt:
      lead.deepEnrichmentCheckedAt ??
      fallback.deepEnrichmentCheckedAt ??
      null,
  };
}

export function opportunityGroupKey(
  city: string,
  state: string,
  segment: string,
) {
  return [
    normalizeLocationText(city),
    normalizeStateCode(state),
    normalizeLocationText(segment),
  ].join("|");
}

export function mergeOpportunityBusinesses(
  observations: OpportunityObservation[],
  leads: PersistedLead[],
) {
  const grouped = new Map<string, OpportunityObservation[]>();
  for (const observation of observations) {
    const placeId = observation.business.placeId;
    if (!placeId) continue;
    const current = grouped.get(placeId) ?? [];
    current.push(observation);
    grouped.set(placeId, current);
  }

  const leadsByPlaceId = new Map(
    leads
      .filter((lead) => Boolean(lead.placeId))
      .map((lead) => [lead.placeId!, lead]),
  );

  return Array.from(grouped.entries()).map(([placeId, rows]) => {
    rows.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    let merged = rows[0]!.business;
    for (const row of rows.slice(1)) {
      merged = mergeBusiness(merged, row.business);
    }

    const lead = leadsByPlaceId.get(placeId);
    if (lead) merged = mergeBusiness(leadAsBusinessPatch(lead, merged), merged);
    return merged;
  });
}

export function sortPriorityBusinesses(businesses: BusinessSearchResult[]) {
  return [...businesses].sort((a, b) => {
    const aNoSite = hasIdentifiedWebsite(a) ? 0 : 1;
    const bNoSite = hasIdentifiedWebsite(b) ? 0 : 1;
    if (aNoSite !== bNoSite) return bNoSite - aNoSite;

    const aPhone = hasBusinessPhone(a) ? 1 : 0;
    const bPhone = hasBusinessPhone(b) ? 1 : 0;
    if (aPhone !== bPhone) return bPhone - aPhone;

    const aActive = hasStableActivitySignal(a) ? 1 : 0;
    const bActive = hasStableActivitySignal(b) ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const reviews = (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
    if (reviews !== 0) return reviews;
    return (b.rating ?? -1) - (a.rating ?? -1);
  });
}
