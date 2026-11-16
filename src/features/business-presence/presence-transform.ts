/** Pure conversion of observed public Instagram data into presence candidates.
 * Never fabricates confidence or source from a placeId.
 */
import type { BusinessPresence, PresenceBusiness } from "./types.ts";

function usernameFromInstagram(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 ? parts[0] : null;
  } catch {
    return null;
  }
}

export function presenceFromBusiness(business: PresenceBusiness): BusinessPresence | null {
  const hasStoredAttempt = Boolean(
    business.instagram?.trim() ||
    business.instagramCheckedAt ||
    business.instagramCandidates?.length ||
    business.instagramSearchSignature,
  );
  if (!hasStoredAttempt) return null;

  const instagramUrl = business.instagram?.trim() || null;

  return {
    instagramUrl,
    instagramUsername:
      business.instagramUsername?.trim() || (usernameFromInstagram(instagramUrl) ?? null),
    instagramDisplayName: business.instagramDisplayName?.trim() || null,
    // Unknown directory confidence MUST NOT become "high" upon CRM save.
    instagramConfidence: instagramUrl ? (business.instagramConfidence ?? "medium") : null,
    // A placeId can be Overture/Geoapify. Never infer Google provenance.
    instagramSource: instagramUrl
      ? (business.instagramSource ?? "existing_data")
      : null,
    instagramCheckedAt: business.instagramCheckedAt ?? new Date(0).toISOString(),
    instagramCandidates: business.instagramCandidates ?? [],
    instagramRejectedUrls: business.instagramRejectedUrls ?? [],
    instagramSearchSignature: business.instagramSearchSignature ?? null,
    ...(business.instagramSearchScope
      ? { instagramSearchScope: business.instagramSearchScope }
      : {}),
    instagramNeedsReview: business.instagramNeedsReview ??
      (Boolean(instagramUrl) && business.instagramConfidence !== "high"),
  };
}
