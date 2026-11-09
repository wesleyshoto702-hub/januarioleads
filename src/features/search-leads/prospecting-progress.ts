import { normalizeLocationText, normalizeStateCode } from "../../lib/location";
import { normalizeSearchText, resolveSearchSegment } from "./segments";
import type { ExistingLeadIdentity } from "./identity";
import type { BusinessSearchResult } from "./types";

/**
 * Contact is confirmed ONLY by the existing "Confirmar envio" WhatsApp event
 * (lead_activities.metadata.confirmation === "user"). A CRM status alone
 * is never presented as proof of a sent message.
 */
export type ProspectingSummary = {
  total: number;
  saved: number;
  confirmed: number;
  legacy: number;
  savedPercent: number;
  confirmedPercent: number;
};

const empty = (): ProspectingSummary => ({
  total: 0, saved: 0, confirmed: 0, legacy: 0,
  savedPercent: 0, confirmedPercent: 0,
});

function ratio(count: number, total: number): number {
  return total > 0 ? Math.round((1000 * count) / total) / 10 : 0;
}

function nicheKey(segment: string | null | undefined): string {
  const name = (segment ?? "").trim();
  return normalizeSearchText(resolveSearchSegment(name) ?? name);
}

function hasLegacyContact(lead: ExistingLeadIdentity): boolean {
  return lead.status === "waiting" || lead.status === "accepted" || lead.status === "rejected";
}

function leadIdentityKey(lead: ExistingLeadIdentity): string {
  return lead.id || [
    normalizeLocationText(lead.company),
    normalizeLocationText(lead.address),
    normalizeLocationText(lead.phone),
  ].join("|");
}

/** A read-only summary of the user's saved CRM, before invoking an API search. */
export function summarizeSavedProspecting(
  leads: readonly ExistingLeadIdentity[],
  location: { city: string; state: string; segment: string },
  confirmedLeadIds: ReadonlySet<string>,
): ProspectingSummary {
  const result = empty();
  const targetSegment = nicheKey(location.segment);
  const targetCity = normalizeLocationText(location.city);
  const targetState = normalizeStateCode(location.state);
  if (!targetSegment || !targetCity || !targetState) return result;

  const seen = new Set<string>();
  for (const lead of leads) {
    if (
      nicheKey(lead.segment) !== targetSegment ||
      normalizeLocationText(lead.city) !== targetCity ||
      normalizeStateCode(lead.state) !== targetState
    ) continue;
    const key = leadIdentityKey(lead);
    if (seen.has(key)) continue;
    seen.add(key);
    result.saved++;
    result.total++;
    if (lead.id && confirmedLeadIds.has(lead.id)) result.confirmed++;
    else if (hasLegacyContact(lead)) result.legacy++;
  }
  result.savedPercent = ratio(result.saved, result.total);
  result.confirmedPercent = ratio(result.confirmed, result.total);
  return result;
}

/**
 * Search denominator = businesses actually loaded (not all companies in a city).
 * The existing duplicate matcher links these results to saved CRM leads.
 */
export function summarizeLoadedProspecting(
  matches: readonly {
    business: Pick<BusinessSearchResult, "placeId" | "name" | "address">;
    existingLead: ExistingLeadIdentity | null;
  }[],
  confirmedLeadIds: ReadonlySet<string>,
): ProspectingSummary {
  const result = empty();
  const seenResults = new Set<string>();
  for (const item of matches) {
    const business = item.business;
    const key = business.placeId || [
      normalizeLocationText(business.name),
      normalizeLocationText(business.address),
    ].join("|");
    if (seenResults.has(key)) continue;
    seenResults.add(key);
    result.total++;
    const lead = item.existingLead;
    if (!lead) continue;
    result.saved++;
    if (lead.id && confirmedLeadIds.has(lead.id)) result.confirmed++;
    else if (hasLegacyContact(lead)) result.legacy++;
  }
  result.savedPercent = ratio(result.saved, result.total);
  result.confirmedPercent = ratio(result.confirmed, result.total);
  return result;
}
