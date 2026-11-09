-- STAGING: targeted foreign-key indexes suggested by Supabase performance advisor.
-- No DML, no credential changes, no production access.
CREATE INDEX IF NOT EXISTS business_enrichment_facts_lead_id_idx ON public.business_enrichment_facts(lead_id);
CREATE INDEX IF NOT EXISTS business_enrichment_facts_source_id_idx ON public.business_enrichment_facts(source_id);
CREATE INDEX IF NOT EXISTS business_enrichment_runs_lead_id_idx ON public.business_enrichment_runs(lead_id);
CREATE INDEX IF NOT EXISTS business_enrichment_sources_lead_id_idx ON public.business_enrichment_sources(lead_id);
CREATE INDEX IF NOT EXISTS business_enrichment_sources_user_id_idx ON public.business_enrichment_sources(user_id);
