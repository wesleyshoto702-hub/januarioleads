-- Keep the persisted bucket constraint aligned with claim_api_request_for_user.
BEGIN;
ALTER TABLE public.api_request_rate_limit
  DROP CONSTRAINT IF EXISTS api_request_rate_limit_bucket_check;
ALTER TABLE public.api_request_rate_limit
  ADD CONSTRAINT api_request_rate_limit_bucket_check CHECK (
    bucket IN ('places_search', 'lead_enrichment', 'presence_discovery', 'presence_site', 'deep_enrichment')
  );
COMMIT;
