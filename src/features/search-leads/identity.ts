import type { LeadStatus } from "../leads/remote-leads";
import type { InstagramSource } from "../business-presence/types";
import type { BusinessSearchResult } from "./types";
import { normalizeSearchText } from "./segments";
import { sameLocation } from "../../lib/location";

export type ExistingLeadIdentity = {
  id?: string | undefined;
  company: string;
  segment?: string | undefined;
  phone: string;
  placeId?: string | undefined;
  address?: string | undefined;
  neighborhood?: string | undefined;
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

export function findBusinessDuplicate(
  business: BusinessSearchResult,
  leads: ExistingLeadIdentity[],
  excludeId?: string,
) {
  const businessName = normalizeIdentity(business.name);
  const businessAddress = normalizeIdentity(business.address);

  return (
    leads.find((lead) => {
      if (excludeId && lead.id === excludeId) return false;

      if (business.placeId && lead.placeId && business.placeId === lead.placeId) {
        return true;
      }

      // A phone can belong to a parent company or shared service desk;
      // the same number is NOT proof that two branches are one CRM lead.
      // Preserve separate cities even if name and street happen to match.
      const knownDifferentCities = Boolean(
        business.city?.trim() &&
        business.state?.trim() &&
        lead.city?.trim() &&
        lead.state?.trim() &&
        !sameLocation(business, lead),
      );
      if(knownDifferentCities)return false;

      // Only the same upstream placeId OR a matching name and known address
      // can mark an existing CRM lead. Missing addresses stay unresolved.
      return Boolean(
        businessName &&
        businessAddress &&
        normalizeIdentity(lead.company) === businessName &&
        normalizeIdentity(lead.address) === businessAddress
      );
    }) ?? null
  );
}

export function businessAlreadyExists(
  business: BusinessSearchResult,
  leads: ExistingLeadIdentity[],
) {
  return Boolean(findBusinessDuplicate(business, leads));
}
