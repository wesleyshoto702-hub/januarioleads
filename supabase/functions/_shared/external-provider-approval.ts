/**
 * Cost gate for optional external enrichment. Missing/malformed config is DENY,
 * even when the paid provider's API key exists in Supabase secrets.
 *
 * This is an opt-in SWITCH, not the sole billing protection: every allowed
 * request must ALSO reserve an operation-specific atomic Postgres budget.
 * Direct use of these providers elsewhere must be guarded separately.
 */
export type ExternalPlacesProvider = "geoapify" | "google_places";

export function approvedExternalPlacesDailyCap(
  provider: ExternalPlacesProvider,
  rawCap: string | undefined,
  googleSpendApproved: string | undefined,
): number {
  // Google Enterprise SKUs may incur charges even when the project has a key.
  if (provider === "google_places" && googleSpendApproved !== "true") return 0;
  if (typeof rawCap !== "string" || !/^[1-9]\d*$/.test(rawCap.trim())) return 0;
  const requested = Number(rawCap.trim());
  if (!Number.isSafeInteger(requested)) return 0;
  return Math.min(requested, provider === "google_places" ? 20 : 300);
}

/** Optional API keys are never spending authorization. Raw cap is an
 * eligibility switch only: separate server-side atomic quota is mandatory.
 */
export function mayContactExternalPlacesProvider(
  provider: ExternalPlacesProvider,
  apiKey: string | undefined | null,
  rawCap: string | undefined,
  googleSpendApproved: string | undefined,
): boolean {
  return Boolean(apiKey?.trim()) &&
    approvedExternalPlacesDailyCap(provider, rawCap, googleSpendApproved) > 0;
}

/** OpenAI Instagram web discovery is also billable. A positive configured
 * cap and explicit approval are prerequisites, NOT a usage limiter.
 * Actual use is blocked until an atomic per-project claim RPC returns true.
 */
export function approvedInstagramWebSearchDailyCap(
  rawCap: string | undefined,
  spendApproved: string | undefined,
): number {
  if (spendApproved !== "true" ||
      typeof rawCap !== "string" ||
      !/^[1-9]\\d*$/.test(rawCap.trim())) return 0;
  const cap=Number(rawCap.trim());
  if (!Number.isSafeInteger(cap)) return 0;
  return Math.min(cap, 5);
}
