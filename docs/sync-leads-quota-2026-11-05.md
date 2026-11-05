# Google Places quota protection for scheduled lead sync — 2026-11-05

## Incident confirmed (read-only diagnostics)

- The sync cron job is active on `0 */8 * * *`.
- Production records reported `Google Places returned 429: RESOURCE_EXHAUSTED`.
- At the time of investigation, 195 of 197 leads had a recent quota error.
- The 16:00 UTC run on 2026-11-05 added 136 separate `sync_error` activities.
- The scheduler itself was successful; the issue occurred downstream in Google Place Details.

The Google Cloud project's precise quota/billing limit cannot be derived from
the generic 429 response. **Do not increase quotas or enable billing automatically.**

## Code change

- Cap the number of Place Details attempts per invocation at 30.
- Run requests sequentially, at least 500ms apart.
- Do not re-fetch a lead successfully synchronized in the past 24 hours.
- Cool down other per-lead failures for 24 hours.
- On Google's 429 / RESOURCE_EXHAUSTED response, **stop the entire batch**
  immediately; do not retry in seconds and do not create one failure activity
  per lead. The scheduled job may try again later.
- Keep existing lead details and all activity history unchanged.
- Give the invocation a 100-second budget to reduce timeout risk.

The schedule remains every eight hours, but this is now a *batch schedule*,
not a promise that every company will be refreshed every eight hours.
With 197 leads and no external quota blocks, a full refresh cycle will span
multiple scheduled runs.

## Verification / release checklist

1. Unit tests: `deno test supabase/functions/_shared/sync-policy.test.ts`.
2. Type checking: `deno check supabase/functions/sync-leads/index.ts`.
3. Ensure the standard GitHub CI passes on the pull request.
4. Review and merge the fix. Deploy **sync-leads** specifically; the existing
   deployment workflow for search-places does not deploy this function.
5. Keep `verify_jwt=false` for this existing cron-only function because it
   authorizes callers through `x-sync-secret` plus the stored hash. Do not
   leak or rotate this secret as part of a quota fix.
6. Verify the active Edge Function version, recent function logs, and the
   `cron.job_run_details` schedule status. There is no need to trigger a
   manual bulk sync against real Google billing.
7. Check Google Cloud Console → Google Maps Platform → Quotas and the
   billing/usage reports for *Places API (New) / Place Details* before
   adjusting quotas or making higher-volume changes.
8. Leave historical `sync_error` activities intact unless the owner later
   authorizes a separate audited cleanup.

## Operational note

If the Google quota remains exhausted, this patch prevents the application
from flooding its customers with repetitive failure activities but cannot
restore Google API responses by itself. The application's normal lead data
and CRM operations are unaffected by this batch circuit breaker.
