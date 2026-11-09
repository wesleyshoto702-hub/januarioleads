-- STAGING ONLY. Read-only release checks (no inserts, no mutations).
-- Fails closed if pricing, entitlements, RLS or cache protections drift.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.saas_plans
  WHERE (code='free' AND price_cents=0 AND daily_lead_limit=5 AND active)
     OR (code='pro' AND price_cents=1990 AND daily_lead_limit=25 AND active)
     OR (code='advanced' AND price_cents=2990 AND daily_lead_limit=70 AND active);
  IF v_count <> 3 THEN RAISE EXCEPTION 'SaaS plan catalog drift'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.saas_plan_features WHERE feature_key='maps_search'
    AND ((plan_code='free' AND enabled)
      OR (plan_code IN ('pro','advanced') AND NOT enabled))
  ) OR (SELECT count(*) FROM public.saas_plan_features
      WHERE feature_key='maps_search' AND plan_code IN ('free','pro','advanced')) <> 3
  THEN RAISE EXCEPTION 'Maps entitlement drift'; END IF;

  IF position('Pro or Advanced' IN
      pg_get_functiondef('public.claim_daily_leads_for_user(uuid,text[],text)'::regprocedure)) = 0
  THEN RAISE EXCEPTION 'Maps credit RPC gate drift'; END IF;

  SELECT count(*) INTO v_count FROM pg_indexes WHERE schemaname='public'
    AND indexname IN (
      'business_enrichment_facts_lead_id_idx',
      'business_enrichment_facts_source_id_idx',
      'business_enrichment_runs_lead_id_idx',
      'business_enrichment_sources_lead_id_idx',
      'business_enrichment_sources_user_id_idx'
    );
  IF v_count <> 5 THEN RAISE EXCEPTION 'Missing enrichment FK indexes'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid=i.indexrelid
    WHERE c.relname='leads_user_place_id_staging_unique_idx'
      AND i.indisunique AND i.indisvalid
  ) THEN RAISE EXCEPTION 'CRM duplicate unique index unavailable'; END IF;

  IF has_table_privilege('anon','public.places_search_cache','INSERT')
    OR has_table_privilege('authenticated','public.places_search_cache','INSERT')
    OR has_table_privilege('authenticated','public.places_search_cache','UPDATE')
  THEN RAISE EXCEPTION 'Places cache browser write privilege is open'; END IF;

  IF EXISTS (SELECT 1 FROM public.places_search_cache
    WHERE jsonb_array_length(results) > 0)
  THEN RAISE EXCEPTION 'Persisted Google Places result cache requires review'; END IF;

  IF EXISTS (SELECT 1 FROM public.leads
    WHERE place_id IS NOT NULL AND place_id NOT LIKE 'geoapify:%'
    AND (address IS NOT NULL OR website IS NOT NULL OR
         latitude IS NOT NULL OR longitude IS NOT NULL))
  THEN RAISE EXCEPTION 'Legacy Google CRM metadata requires human review'; END IF;
END $$;
