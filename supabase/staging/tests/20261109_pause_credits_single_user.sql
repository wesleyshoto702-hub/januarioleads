-- Regression test (STAGING ONLY). No provider API calls, no persistent changes.
-- ROLLBACK ensures even the temporary toggle round-trip is discarded.
BEGIN;
DO $test$
DECLARE
  u uuid;
  b_search bigint;
  b_daily bigint;
  b_credit bigint;
  b_unlock bigint;
  r jsonb;
  e jsonb;
BEGIN
  IF (SELECT count(*) FROM public.private_access WHERE quota_test_mode)=1 THEN
    SELECT user_id INTO u FROM public.private_access WHERE quota_test_mode;
  ELSE
    RAISE EXCEPTION 'Expected exactly one staging test user';
  END IF;
  IF u IS NULL OR (SELECT count(*) FROM auth.users)<>1 THEN
    RAISE EXCEPTION 'Invalid staging account ownership';
  END IF;

  SELECT count(*) INTO b_search FROM public.saas_daily_search_usage WHERE user_id=u;
  SELECT count(*) INTO b_daily FROM public.saas_daily_usage WHERE user_id=u;
  SELECT count(*) INTO b_credit FROM public.saas_daily_credit_leads WHERE user_id=u;
  SELECT count(*) INTO b_unlock FROM public.saas_lead_unlocks WHERE user_id=u;

  r := public.saas_free_search_quota(u,true);
  IF (r->>'test_mode')::boolean IS DISTINCT FROM true OR
     (r->>'allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Search quota not bypassed: %',r;
  END IF;
  r := public.saas_free_search_quota(u,true);
  IF (r->>'test_mode')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Second search not bypassed';
  END IF;

  r := public.peek_daily_leads_for_user(u);
  IF (r->>'test_mode')::boolean IS DISTINCT FROM true OR
     (r->>'remaining_today')::integer < 20 THEN
    RAISE EXCEPTION 'Daily lead preflight still limited: %',r;
  END IF;

  r := public.claim_daily_leads_for_user_with_aliases(
    u,ARRAY['StagingTest_Google_Barber_9981'],'search','{}'::jsonb
  );
  IF (r->>'test_mode')::boolean IS DISTINCT FROM true OR
     (r->>'credits_spent')::integer <> 0 OR
     NOT (r->'allowed_place_ids' ? 'StagingTest_Google_Barber_9981') THEN
    RAISE EXCEPTION 'Standard lead claim still debits: %',r;
  END IF;

  r := public.claim_daily_maps_with_osm_anchors(
    u,ARRAY['geoapify:StagingTestNode9982'],'{}'::jsonb,'[]'::jsonb
  );
  IF (r->>'test_mode')::boolean IS DISTINCT FROM true OR
     (r->>'credits_spent')::integer <> 0 OR
     NOT (r->'allowed_place_ids' ? 'geoapify:StagingTestNode9982') THEN
    RAISE EXCEPTION 'Maps claim still debits: %',r;
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',u::text,true);
  e := public.get_my_saas_entitlements();
  IF (e->>'test_mode')::boolean IS DISTINCT FROM true OR
     (e->'features'->>'maps_search')::boolean IS DISTINCT FROM true OR
     public.saas_my_feature_enabled('maps_search') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Test account not entitled to Maps: %',e;
  END IF;

  IF (SELECT count(*) FROM public.saas_daily_search_usage WHERE user_id=u) <> b_search OR
     (SELECT count(*) FROM public.saas_daily_usage WHERE user_id=u) <> b_daily OR
     (SELECT count(*) FROM public.saas_daily_credit_leads WHERE user_id=u) <> b_credit OR
     (SELECT count(*) FROM public.saas_lead_unlocks WHERE user_id=u) <> b_unlock THEN
    RAISE EXCEPTION 'Staging test mode mutated daily counters or unlock ledger';
  END IF;

  -- Simulate the complete reactivation switch and verify it restores
  -- original entitlements and the original Free limit display.
  UPDATE public.private_access SET quota_test_mode=false WHERE user_id=u;
  e := public.get_my_saas_entitlements();
  IF (e->>'test_mode')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Test mode could not be disabled: %',e;
  END IF;
  r := public.saas_free_search_quota(u,false);
  IF r ? 'test_mode' THEN
    RAISE EXCEPTION 'Disabled mode did not restore ordinary search quotas: %',r;
  END IF;
  -- The transaction rollback restores the enabled flag.
END
$test$;
ROLLBACK;
