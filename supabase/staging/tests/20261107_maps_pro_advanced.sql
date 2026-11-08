-- STAGING ONLY. Verify gate while impersonating an authenticated user.
-- No actual Places calls, all subscription fixtures are rolled back.
BEGIN;
DELETE FROM public.saas_subscriptions WHERE user_id=(SELECT user_id FROM public.private_access LIMIT 1);
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE ent jsonb;
BEGIN
  IF public.saas_my_feature_enabled('maps_search') THEN
    RAISE EXCEPTION 'Free can use Maps';
  END IF;
  ent := public.get_my_saas_entitlements();
  IF (ent->>'plan') <> 'free' OR (ent->'features'->>'maps_search')::boolean THEN
    RAISE EXCEPTION 'Free entitlements wrong: %',ent;
  END IF;
  RAISE NOTICE 'PASS free map denied';
END $$;
ROLLBACK;

BEGIN;
INSERT INTO public.saas_subscriptions(user_id, plan_code, status, period_start, period_end)
SELECT user_id,'pro','active',now(),now()+interval '30 days'
FROM public.private_access LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET plan_code=excluded.plan_code,status='active',period_end=excluded.period_end;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE ent jsonb;
BEGIN
  IF public.saas_my_feature_enabled('maps_search') THEN
    RAISE EXCEPTION 'Pro Maps should be blocked';
  END IF;
  ent := public.get_my_saas_entitlements();
  IF (ent->>'daily_limit')::integer <> 25 OR (ent->'features'->>'maps_search')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Pro entitlements wrong: %',ent;
  END IF;
  RAISE NOTICE 'PASS Pro: 25 credits, no Maps';
END $$;
ROLLBACK;

BEGIN;
INSERT INTO public.saas_subscriptions(user_id, plan_code, status, period_start, period_end)
SELECT user_id,'advanced','active',now(),now()+interval '30 days'
FROM public.private_access LIMIT 1;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE ent jsonb;
BEGIN
  IF NOT public.saas_my_feature_enabled('maps_search') THEN
    RAISE EXCEPTION 'Advanced map denied';
  END IF;
  ent := public.get_my_saas_entitlements();
  IF (ent->>'daily_limit')::integer <> 70 OR (ent->'features'->>'maps_search')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Advanced entitlements wrong: %',ent;
  END IF;
  RAISE NOTICE 'PASS Advanced maps and 70 leads';
END $$;
ROLLBACK;
