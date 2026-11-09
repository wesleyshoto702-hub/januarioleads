import type { BusinessSearchResult } from "./types";

/** Provider content is view-only. Staging CRM stores only a Google Place ID
 * and a contact label independently typed by the customer.
 * The helper intentionally does not copy Google name, address, contact,
 * coordinates, URLs, categories, images, ratings or derived descriptions.
 */
export function googleCrmNeedsOwnName(business: BusinessSearchResult): boolean {
  return Boolean(business.placeId && !business.placeId.startsWith("geoapify:"));
}

export function isIdOnlyGoogleCrmCandidate(business: BusinessSearchResult): boolean {
  return googleCrmNeedsOwnName(business) &&
    business.address === null &&
    business.city === null &&
    business.state === null &&
    business.phone === null &&
    business.internationalPhone === null &&
    business.latitude === null &&
    business.longitude === null &&
    business.googleMapsUrl === null &&
    business.website === null &&
    business.instagram === null &&
    business.description === null &&
    business.factualDescription == null &&
    business.primaryCategory === null &&
    business.categories.length === 0 &&
    business.rating === null &&
    business.reviewCount === null &&
    business.isOpenNow === null &&
    business.openingHours.length === 0 &&
    business.currentOpeningHours == null &&
    business.regularOpeningHours == null &&
    business.verifiedContent == null &&
    business.verifiedImages == null &&
    business.confirmedChannels == null;
}

export function googlePlaceIdAndOwnName(
  business: BusinessSearchResult,
  nameTypedByUser: string,
): BusinessSearchResult | null {
  const name = nameTypedByUser.trim();
  if (!googleCrmNeedsOwnName(business) || name.length < 3 || name.length > 120) return null;
  // Explicit field allowlist: no provider content can leak via spread/rest.
  return {
    placeId: business.placeId,
    equivalentPlaceId: business.equivalentPlaceId ?? null,
    crmManualName: true,
    name, primaryCategory: null, categories: [], description: null,
    address: null, neighborhood: null, city: null, state: null,
    phone: null, internationalPhone: null,
    rating: null, reviewCount: null, isOpenNow: null,
    openingHours: [], currentOpeningHours: null, regularOpeningHours: null,
    website: null, instagram: null, googleMapsUrl: null,
    businessStatus: null, latitude: null, longitude: null,
  };
}
