-- Align persisted rate-limit buckets with claim_api_request_for_user.
-- Single atomic statement: also compatible with Management API query execution.
-- This migration changes only a CHECK constraint, never existing lead data.
ALTER TABLE public.api_request_rate_limit
  DROP CONSTRAINT IF EXISTS api_request_rate_limit_bucket_check,
  ADD CONSTRAINT api_request_rate_limit_bucket_check CHECK (
    bucket IN (
      'places_search',
      'lead_enrichment',
      'presence_discovery',
      'presence_site',
      'deep_enrichment'
    )
  );
