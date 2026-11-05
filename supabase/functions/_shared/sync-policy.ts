/**
 * Conservative scheduled Place Details policy.
 * Cron still runs every 8 hours, but it should not refresh the entire CRM
 * three times a day or keep hammering Google after the quota is exhausted.
 */
export const MAX_PLACES_LOOKUPS_PER_RUN = 30;
export const MIN_DETAILS_REQUEST_GAP_MS = 500;
export const MAX_SYNC_WALL_TIME_MS = 100_000;
export const MIN_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const FAILURE_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type SyncTiming = {
  last_synced_at: string | null;
  last_sync_error_at: string | null;
  last_sync_error: string | null;
};

function wasRecent(value: string | null, now: number, interval: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < interval;
}

export function isQuotaResponse(httpStatus: number, googleStatus?: string): boolean {
  return httpStatus === 429 || googleStatus === "RESOURCE_EXHAUSTED";
}

function wasQuotaError(message: string | null): boolean {
  return Boolean(message && /^Google Places returned 429:/i.test(message));
}

/** Old quota warnings are not treated as permanent per-lead errors. */
export function shouldAttemptSyncLead(
  lead: SyncTiming,
  now: number = Date.now(),
): boolean {
  if (wasRecent(lead.last_synced_at, now, MIN_REFRESH_INTERVAL_MS)) {
    return false;
  }

  if (
    lead.last_sync_error &&
    !wasQuotaError(lead.last_sync_error) &&
    wasRecent(lead.last_sync_error_at, now, FAILURE_RETRY_INTERVAL_MS)
  ) {
    return false;
  }

  return true;
}

export class GooglePlacesQuotaError extends Error {
  constructor() {
    super("Google Places quota exhausted");
    this.name = "GooglePlacesQuotaError";
  }
}
