import {
  MAX_PLACES_LOOKUPS_PER_RUN,
  MIN_REFRESH_INTERVAL_MS,
  GooglePlacesQuotaError,
  isQuotaResponse,
  shouldAttemptSyncLead,
} from "./sync-policy.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const NOW = Date.parse("2026-11-05T16:00:00.000Z");

Deno.test("Google 429 and RESOURCE_EXHAUSTED activate the sync quota circuit breaker", () => {
  assert(isQuotaResponse(429, "RESOURCE_EXHAUSTED"), "429 must stop the batch");
  assert(isQuotaResponse(429, undefined), "HTTP 429 alone must stop the batch");
  assert(isQuotaResponse(400, "RESOURCE_EXHAUSTED"), "Resource-exhausted payload must stop");
  assert(!isQuotaResponse(503, "UNAVAILABLE"), "Other transient errors must not look like quota");
  assert(!isQuotaResponse(404, "NOT_FOUND"), "Missing business must not stop all leads");
  assert(new GooglePlacesQuotaError() instanceof Error, "Quota errors must be typed");
});

Deno.test("successful refreshes are not queried again on each 8-hour cron run", () => {
  const recent = {
    last_synced_at: new Date(NOW - 8 * 60 * 60 * 1000).toISOString(),
    last_sync_error_at: null,
    last_sync_error: null,
  };
  assert(!shouldAttemptSyncLead(recent, NOW), "A lead refreshed 8h ago must be skipped");
  assert(shouldAttemptSyncLead({
    ...recent,
    last_synced_at: new Date(NOW - MIN_REFRESH_INTERVAL_MS).toISOString(),
  }, NOW), "A lead due for refresh should be retried");
});

Deno.test("fresh per-lead failures cool down, but existing quota errors can be probed later", () => {
  const recentError = new Date(NOW - 8 * 60 * 60 * 1000).toISOString();
  assert(!shouldAttemptSyncLead({
    last_synced_at: null,
    last_sync_error_at: recentError,
    last_sync_error: "Google Places returned 404: NOT_FOUND",
  }, NOW), "Known recent non-quota errors should not be repeated every 8h");
  assert(shouldAttemptSyncLead({
    last_synced_at: null,
    last_sync_error_at: recentError,
    last_sync_error: "Google Places returned 429: RESOURCE_EXHAUSTED",
  }, NOW), "An old quota status must not permanently exclude the lead");
});

Deno.test("never-synced and invalid-timestamp leads remain eligible for refresh", () => {
  assert(shouldAttemptSyncLead({
    last_synced_at: null,
    last_sync_error_at: null,
    last_sync_error: null,
  }, NOW), "New leads must be eligible");
  assert(shouldAttemptSyncLead({
    last_synced_at: "invalid",
    last_sync_error_at: null,
    last_sync_error: null,
  }, NOW), "A malformed time must not block syncing forever");
});

Deno.test("scheduled sync has a bounded Place Details request budget", () => {
  assert(MAX_PLACES_LOOKUPS_PER_RUN > 0 && MAX_PLACES_LOOKUPS_PER_RUN <= 30,
    "The scheduled sync must have a small per-run budget");
});
