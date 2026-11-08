-- Read/write tests ONLY on Supabase Staging. No Google calls, no persistent data.
-- All updates to cost limits, quotas and counters are rolled back.
BEGIN;
DO $$
DECLARE
  u uuid;
  v_claim jsonb;
  v_result boolean;
  i integer;
BEGIN
  SELECT user_id INTO u FROM public.private_access LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'No authorized staging test user'; END IF;

  -- Search and Maps share one atomic per-user Place-ID unlock ledger.
  v_claim := public.claim_daily_leads_for_user(
    u, ARRAY['staging-shared-place-001','staging-shared-place-002']);
  IF (v_claim->>'newly_unlocked')::integer <> 2 OR
     (v_claim->>'remaining_today')::integer <> 3 THEN
    RAISE EXCEPTION 'Normal search should unlock 2 of 5: %',v_claim;
  END IF;
  v_claim := public.claim_daily_leads_for_user(
    u, ARRAY['staging-shared-place-002','staging-shared-place-003']);
  IF (v_claim->>'newly_unlocked')::integer <> 1 OR
     (v_claim->>'remaining_today')::integer <> 2 THEN
    RAISE EXCEPTION 'Maps must not re-charge existing Place IDs: %',v_claim;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saas_lead_unlocks
    WHERE user_id=u AND place_id='staging-shared-place-003') THEN
      RAISE EXCEPTION 'Map lead not registered in shared ledger';
  END IF;

  -- Service-only API caps, tested with a deliberately tiny limit in transaction.
  IF has_function_privilege('anon','public.claim_saas_google_api_budget(uuid,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.claim_saas_google_api_budget(uuid,text)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.claim_saas_google_api_budget(uuid,text)','EXECUTE')
  THEN RAISE EXCEPTION 'API budget RPC has unsafe grants'; END IF;

  UPDATE public.saas_google_api_limits
    SET daily_project=3,monthly_project=3,daily_user=2
    WHERE operation='text_search_pro';
  FOR i IN 1..2 LOOP
    v_result:=public.claim_saas_google_api_budget(u,'text_search_pro');
    IF NOT v_result THEN RAISE EXCEPTION 'Budget denied permitted request %',i; END IF;
  END LOOP;
  IF public.claim_saas_google_api_budget(u,'text_search_pro') THEN
    RAISE EXCEPTION 'Per-user cap was bypassed';
  END IF;
  IF public.claim_saas_google_api_budget(u,'unknown-operation') THEN
    RAISE EXCEPTION 'Unknown billable operation allowed';
  END IF;
  IF public.claim_saas_google_api_budget(gen_random_uuid(),'text_search_pro') THEN
    RAISE EXCEPTION 'Unauthorized user consumed project Google budget';
  END IF;
  IF (SELECT request_count FROM public.saas_google_api_usage
      WHERE operation='text_search_pro'
      AND scope='global-day:'||(now() at time zone 'America/Sao_Paulo')::date::text) <> 2
  THEN RAISE EXCEPTION 'Global counter should equal 2'; END IF;

  UPDATE public.saas_google_api_limits SET enabled=false
    WHERE operation='place_details_enterprise';
  IF public.claim_saas_google_api_budget(u,'place_details_enterprise') THEN
    RAISE EXCEPTION 'Kill switch did not block details';
  END IF;
  RAISE NOTICE 'PASS: shared lead quota, no duplicate Place ID, user/global cost caps, kill-switch, RPC grants';
END $$;
ROLLBACK;
