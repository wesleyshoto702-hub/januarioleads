-- Staging only: ACL hardening with existing RLS policies preserved.
-- The anonymous role has no write RLS policies on these internal tables.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON public.leads, public.lead_payments, public.lead_activities,
   public.lead_updates, public.private_access,
   public.business_enrichment_facts, public.business_enrichment_runs,
   public.business_enrichment_sources, public.sync_internal_config,
   public.api_request_rate_limit
FROM anon;
-- These specific tables have read-only or deny-all authenticated policies;
-- keep legitimate authenticated writes to leads, activities and CRM features.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON public.private_access, public.business_enrichment_facts,
   public.business_enrichment_runs, public.business_enrichment_sources,
   public.sync_internal_config, public.api_request_rate_limit
FROM authenticated;
REVOKE SELECT ON public.sync_internal_config, public.api_request_rate_limit
FROM anon, authenticated;
