/** Pure functions shared by Buscar Leads UI and offline regression tests.
 * Filtering only examines already-fetched data. It never calls providers.
 * A phone filter means a number IS LISTED, NOT verified active.
 * WhatsApp means only compatible PHONE FORMAT, NOT an active account.
 * Site/Instagram "not identified" is NOT verified absence.
 */
import type { LeadStatus } from "../leads/remote-leads.ts";
import type { LeadChanceResult } from "../lead-chance/lead-chance.ts";
import { normalizeBrazilianPhone, type ExistingLeadIdentity } from "./identity.ts";
import { hasUsableBusinessEmail } from "./business-contact.ts";
import { isValidWhatsAppPhone } from "../../lib/whatsapp.ts";
import type { BusinessSearchResult } from "./types.ts";

export type ResultFilter =
  | "all"
  | "phone"
  | "email"
  | "whatsapp"
  | "with-site"
  | "without-site"
  | "with-instagram"
  | "without-instagram";

export type ResultSort =
  | "chance-desc"
  | "chance-asc"
  | "rating"
  | "reviews"
  | "az"
  | "za";

export type LeadStatusFilter = "all" | "new" | LeadStatus;

export type ContactFilter = "all" | "phone" | "email" | "whatsapp";
export type WebsiteFilter = "all" | "with-site" | "without-site";
export type InstagramFilter = "all" | "with-instagram" | "without-instagram";
export type ChanceFilter = "all" | "high";

export type ResultFilterState = {
  contact: ContactFilter;
  website: WebsiteFilter;
  instagram: InstagramFilter;
  chance: ChanceFilter;
};


export type ResultWithContext = {
  business: BusinessSearchResult;
  existingLead: ExistingLeadIdentity | null;
  alreadyAdded: boolean;
  chance: LeadChanceResult;
};

export const DEFAULT_RESULT_FILTERS: ResultFilterState = {
  contact: "all",
  website: "all",
  instagram: "all",
  chance: "all",
};


export function normalizedBusinessPhone(business: BusinessSearchResult) {
  return normalizeBrazilianPhone(
    business.phone?.trim() || business.internationalPhone?.trim(),
  );
}

/** A phone reported by a provider is NOT evidence of a live number. */
export function hasIdentifiedBusinessPhone(business: BusinessSearchResult) {
  return Boolean(business.phone?.trim() || business.internationalPhone?.trim());
}

/** Format-only check retained for callers that explicitly require valid BR digits. */
export function hasValidBusinessPhone(business: BusinessSearchResult) {
  return isValidWhatsAppPhone(normalizedBusinessPhone(business));
}

export function hasUsableWhatsApp(business: BusinessSearchResult) {
  return isValidWhatsAppPhone(normalizedBusinessPhone(business));
}

export function hasIdentifiedWebsite(business: BusinessSearchResult) {
  return Boolean(business.website?.trim());
}

export function hasConfirmedInstagram(business: BusinessSearchResult) {
  return Boolean(
    business.instagram?.trim() &&
      business.instagramConfidence === "high" &&
      !business.instagramNeedsReview,
  );
}

export function hasHighChance(chance: LeadChanceResult) {
  return chance.band === "high" || chance.band === "very-high";
}

export function sameResultFilters(
  left: ResultFilterState,
  right: ResultFilterState,
) {
  return (
    left.contact === right.contact &&
    left.website === right.website &&
    left.instagram === right.instagram &&
    left.chance === right.chance
  );
}

export function manualResultFilters(value: ResultFilter): ResultFilterState {
  if (value === "phone") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "phone" };
  }
  if (value === "whatsapp") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "whatsapp" };
  }
  if (value === "email") {
    return { ...DEFAULT_RESULT_FILTERS, contact: "email" };
  }
  if (value === "with-site") {
    return { ...DEFAULT_RESULT_FILTERS, website: "with-site" };
  }
  if (value === "without-site") {
    return { ...DEFAULT_RESULT_FILTERS, website: "without-site" };
  }
  if (value === "with-instagram") {
    return { ...DEFAULT_RESULT_FILTERS, instagram: "with-instagram" };
  }
  if (value === "without-instagram") {
    return { ...DEFAULT_RESULT_FILTERS, instagram: "without-instagram" };
  }
  return DEFAULT_RESULT_FILTERS;
}

export function isManualResultFilterActive(
  value: ResultFilter,
  filters: ResultFilterState,
) {
  if (value === "all") return sameResultFilters(filters, DEFAULT_RESULT_FILTERS);
  if (value === "phone") return filters.contact === "phone";
  if (value === "whatsapp") return filters.contact === "whatsapp";
  if (value === "email") return filters.contact === "email";
  if (value === "with-site") return filters.website === "with-site";
  if (value === "without-site") return filters.website === "without-site";
  if (value === "with-instagram") return filters.instagram === "with-instagram";
  return filters.instagram === "without-instagram";
}

export function matchesResultFilters(
  item: ResultWithContext,
  filters: ResultFilterState,
  leadStatusFilter: LeadStatusFilter,
) {
  const { business, existingLead } = item;

  if (leadStatusFilter === "new" && existingLead) return false;
  if (
    leadStatusFilter !== "all" &&
    leadStatusFilter !== "new" &&
    existingLead?.status !== leadStatusFilter
  ) {
    return false;
  }

  if (filters.contact === "phone" && !hasIdentifiedBusinessPhone(business)) {
    return false;
  }
  if (filters.contact === "email" && !hasUsableBusinessEmail(business.email)) {
    return false;
  }
  if (filters.contact === "whatsapp" && !hasUsableWhatsApp(business)) {
    return false;
  }

  const hasWebsite = hasIdentifiedWebsite(business);
  if (filters.website === "with-site" && !hasWebsite) return false;
  if (filters.website === "without-site" && hasWebsite) return false;

  const hasInstagram = hasConfirmedInstagram(business);
  if (filters.instagram === "with-instagram" && !hasInstagram) return false;
  if (filters.instagram === "without-instagram" && hasInstagram) return false;

  if (filters.chance === "high" && !hasHighChance(item.chance)) return false;

  return true;
}

