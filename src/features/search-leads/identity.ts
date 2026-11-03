import type { LeadStatus } from "../leads/remote-leads";
import type { InstagramSource } from "../business-presence/types";
import type { BusinessSearchResult } from "./types";
import { normalizeSearchText } from "./segments";
import { sameLocation } from "../../lib/location";

export type ExistingLeadIdentity = {
  id?: string;
  company: string;
  phone: string;
  placeId?: string;
  address?: string;
  city?: string | undefined;
  state?: string | undefined;
  instagram?: string | undefined;
  instagramConfidence?: "high" | "medium" | "low" | undefined;
  instagramSource?: InstagramSource | undefined;
  instagramNeedsReview?: boolean | undefined;
  instagramCheckedAt?: string | undefined;
  instagramUsername?: string | undefined;
  status?: LeadStatus;
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
  const businessPhone =
    normalizeBrazilianPhone(business.phone) ||
    normalizeBrazilianPhone(business.internationalPhone);
  const businessName = normalizeIdentity(business.name);
  const businessAddress = normalizeIdentity(business.address);

  return (
    leads.find((lead) => {
      if (excludeId && lead.id === excludeId) return false;

      if (
        business.placeId &&
        lead.placeId &&
        business.placeId === lead.placeId
      ) {
        return true;
      }

      const leadPhone = normalizeBrazilianPhone(lead.phone);
      // Separate branches may share a public phone. When both companies have
      // verified different municipalities/UFs, the phone alone isn't enough.
      const knownDifferentCities = Boolean(
        business.city?.trim() &&
        business.state?.trim() &&
        lead.city?.trim() &&
        lead.state?.trim() &&
        !sameLocation(business, lead),
      );
      if (
        businessPhone &&
        leadPhone &&
        businessPhone === leadPhone &&
        !knownDifferentCities
      ) {
        return true;
      }

      return (
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
