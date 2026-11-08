-- Execute in Staging only; each transaction ends with ROLLBACK.
BEGIN;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  u uuid := auth.uid();
  n integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Missing staging auth user'; END IF;
  IF public.saas_my_feature_enabled('finance') OR
     public.saas_my_feature_enabled('internal_automations') THEN
    RAISE EXCEPTION 'Free is not gated';
  END IF;
  SELECT count(*) INTO n FROM public.lead_payments;
  IF n <> 0 THEN RAISE EXCEPTION 'Free can see finance data'; END IF;
  BEGIN
    INSERT INTO public.saas_automation_settings(user_id,follow_up_enabled)
    VALUES (u,true);
    RAISE EXCEPTION 'Free created an automation rule';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.leads(id,user_id,company,segment,first_contact,project_value)
    VALUES (gen_random_uuid(),u,'fixture-free-finance','teste',current_date,100);
    RAISE EXCEPTION 'Free inserted finance value';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RAISE NOTICE 'PASS Free: cannot access finance/automation or save financial columns';
END $$;
ROLLBACK;

BEGIN;
INSERT INTO public.saas_subscriptions (user_id,plan_code,status,period_start,period_end)
SELECT user_id,'pro','active',now(),now()+interval '30 days'
FROM public.private_access LIMIT 1;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  u uuid := auth.uid();
  n integer;
  lid uuid := gen_random_uuid();
BEGIN
  IF NOT public.saas_my_feature_enabled('finance') OR
     public.saas_my_feature_enabled('internal_automations') THEN
    RAISE EXCEPTION 'Pro flag mismatch';
  END IF;
  INSERT INTO public.leads(id,user_id,company,segment,first_contact,project_value)
  VALUES (lid,u,'fixture-pro','teste',current_date,140);
  INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method)
  VALUES (lid,u,70,'pix');
  SELECT count(*) INTO n FROM public.lead_payments WHERE lead_id=lid;
  IF n <> 1 THEN RAISE EXCEPTION 'Pro cannot register finance'; END IF;
  BEGIN
    INSERT INTO public.saas_automation_settings(user_id,follow_up_enabled)
    VALUES(u,true);
    RAISE EXCEPTION 'Pro created Advanced rule';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS Pro: finance allowed, Advanced automation denied';
END $$;
ROLLBACK;

BEGIN;
INSERT INTO public.saas_subscriptions (user_id,plan_code,status,period_start,period_end)
SELECT user_id,'advanced','active',now(),now()+interval '30 days'
FROM public.private_access LIMIT 1;
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.private_access LIMIT 1), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  u uuid := auth.uid();
  lid uuid := gen_random_uuid();
  action_type text;
  due date;
  expected date := (now() at time zone 'America/Sao_Paulo')::date + 4;
BEGIN
  IF NOT public.saas_my_feature_enabled('finance') OR
     NOT public.saas_my_feature_enabled('internal_automations') OR
     NOT public.saas_my_feature_enabled('advanced_reports') THEN
    RAISE EXCEPTION 'Advanced flag mismatch';
  END IF;
  INSERT INTO public.saas_automation_settings(user_id, follow_up_enabled, follow_up_after_days)
  VALUES (u,true,4);
  INSERT INTO public.leads(id,user_id,company,segment,first_contact,status)
  VALUES(lid,u,'fixture-advanced','teste',current_date,'waiting');
  SELECT next_action_type,next_action_date INTO action_type,due
  FROM public.leads WHERE id=lid;
  IF action_type <> 'follow_up' OR due <> expected THEN
    RAISE EXCEPTION 'Trigger did not auto-schedule follow-up: %, %',action_type,due;
  END IF;
  UPDATE public.leads SET next_action_date=expected+2 WHERE id=lid;
  SELECT next_action_date INTO due FROM public.leads WHERE id=lid;
  IF due <> expected+2 THEN
    RAISE EXCEPTION 'Automation overwrote explicit user schedule';
  END IF;
  RAISE NOTICE 'PASS Advanced: RLS settings and database trigger schedule follow-up, no overwrite';
END $$;
ROLLBACK;
