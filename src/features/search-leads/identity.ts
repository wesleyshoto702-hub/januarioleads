import type { BusinessSearchResult } from "./types";
import { normalizeSearchText } from "./segments";

export type ExistingLeadIdentity = {
  id?: string;
  company: string;
  phone: string;
  placeId?: string;
  address?: string;
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
      if (businessPhone && leadPhone && businessPhone === leadPhone) {
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
