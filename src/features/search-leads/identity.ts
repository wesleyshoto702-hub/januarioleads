import type { LeadStatus } from "../leads/remote-leads";
import type { InstagramSource } from "../business-presence/types";
import type { BusinessSearchResult } from "./types";
import { normalizeSearchText } from "./segments";
import { sameLocation } from "../../lib/location";

export type ExistingLeadIdentity = {
  id?: string | undefined;
  company: string;
  phone: string;
  placeId?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  instagram?: string | undefined;
  instagramConfidence?: "high" | "medium" | "low" | undefined;
  instagramSource?: InstagramSource | undefined;
  instagramNeedsReview?: boolean | undefined;
  instagramCheckedAt?: string | undefined;
  instagramUsername?: string | undefined;
  instagramDisplayName?: string | undefined;
  status?: LeadStatus | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
};

export function normalizeBrazilianPhone(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  digits = digits.replace(/^0+/, "");
  if (digits && !digits.startsWith("55")) digits = "55" + digits;
  return digits;
}

function normalizeIdentity(value: string | null | undefined) {
  return normalizeSearchText(value ?? "");
}

/** Provider-neutral identity fields used by both lead search and Maps. */
export type BusinessMatchCandidate = {
  placeId?: string | null | undefined;
  name: string;
  phone?: string | null | undefined;
  internationalPhone?: string | null | undefined;
  address?: string | null | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
};

function closeCoordinates(a: BusinessMatchCandidate, b: ExistingLeadIdentity) {
  if (typeof a.latitude !== "number" || typeof a.longitude !== "number" ||
      typeof b.latitude !== "number" || typeof b.longitude !== "number" ||
      ![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite) ||
      Math.abs(a.latitude)>90 || Math.abs(b.latitude)>90 ||
      Math.abs(a.longitude)>180 || Math.abs(b.longitude)>180) return false;
  // Google/OSM may place pins at different doorways. Under 80m plus EXACT
  // normalized business name avoids matching unrelated branches.
  const dLat=(a.latitude-b.latitude)*Math.PI/180;
  const dLon=(a.longitude-b.longitude)*Math.PI/180;
  const rLatA=a.latitude*Math.PI/180;
  const rLatB=b.latitude*Math.PI/180;
  const h=Math.sin(dLat/2)**2+Math.cos(rLatA)*Math.cos(rLatB)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))<=80;
}

/** Match by stable place ID; otherwise phone, or name+address/name+nearby GPS.
 * Different known municipalities/UFs are never conflated.
 * Cross-provider matching does not depend on Google and Geoapify sharing IDs.
 */
export function findSavedBusinessMatch(
  business: BusinessMatchCandidate,
  leads: ExistingLeadIdentity[],
  excludeId?: string,
): ExistingLeadIdentity | null {
  const businessPhone =
    normalizeBrazilianPhone(business.phone) || normalizeBrazilianPhone(business.internationalPhone);
  const businessName = normalizeIdentity(business.name);
  const businessAddress = normalizeIdentity(business.address);
  return leads.find((lead) => {
    if (excludeId && lead.id === excludeId) return false;

    if (business.placeId && lead.placeId && business.placeId === lead.placeId) {
      return true;
    }
    const knownDifferentCities = Boolean(
      business.city?.trim() && business.state?.trim() &&
      lead.city?.trim() && lead.state?.trim() &&
      !sameLocation(
        { city:business.city ?? "", state:business.state ?? "" },
        { city:lead.city ?? "", state:lead.state ?? "" },
      ),
    );
    if (knownDifferentCities) return false;

    const leadPhone=normalizeBrazilianPhone(lead.phone);
    if (businessPhone && leadPhone && businessPhone===leadPhone) return true;

    if (!businessName || normalizeIdentity(lead.company)!==businessName) return false;
    return (Boolean(businessAddress) && normalizeIdentity(lead.address)===businessAddress) ||
      closeCoordinates(business,lead);
  }) ?? null;
}

export function findBusinessDuplicate(
  business: BusinessSearchResult,
  leads: ExistingLeadIdentity[],
  excludeId?: string,
) {
  return findSavedBusinessMatch(business,leads,excludeId);
}

export function businessAlreadyExists(
  business: BusinessSearchResult,
  leads: ExistingLeadIdentity[],
) {
  return Boolean(findBusinessDuplicate(business, leads));
}
