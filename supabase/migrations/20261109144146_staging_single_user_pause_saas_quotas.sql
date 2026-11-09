-- STAGING ONLY: reversible private-account test mode.
-- Pauses SaaS plan gates, free-search and daily-lead debits for the single
-- authorized staging tester. Does not bypass server API spend/abuse budgets.
-- Reactivate for normal billing/quota enforcement with:
-- UPDATE public.private_access SET quota_test_mode=false;
DO $guard$ BEGIN
  IF (SELECT count(*) FROM auth.users)<>1 OR
     (SELECT count(*) FROM public.private_access)<>1 OR
     (SELECT count(*) FROM public.private_access pa
       JOIN auth.users u ON u.id=pa.user_id)<>1 THEN
    RAISE EXCEPTION 'Single-user staging guard failed; no test mode changes applied';
  END IF;
END $guard$;
ALTER TABLE public.private_access
  ADD COLUMN IF NOT EXISTS quota_test_mode boolean NOT NULL DEFAULT false;
UPDATE public.private_access pa SET quota_test_mode=true
 WHERE pa.user_id=(SELECT id FROM auth.users LIMIT 1);

CREATE OR REPLACE FUNCTION public.get_my_saas_entitlements()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_plan text := 'free';
  v_price integer;
  v_limit integer;
  v_used integer := 0;
  v_features jsonb := '{}'::jsonb;
  v_test_mode boolean := false;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then
    return null;
  end if;
  select coalesce(pa.quota_test_mode,false) into v_test_mode
  from public.private_access pa where pa.user_id=v_user;
  v_test_mode:=coalesce(v_test_mode,false);

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active = true
  where s.user_id = v_user
    and s.status = 'active'
    and s.period_end > now();
  v_plan := coalesce(v_plan, 'free');

  select p.price_cents, p.daily_lead_limit into v_price, v_limit
  from public.saas_plans p where p.code = v_plan;
  select coalesce(u.used, 0) into v_used
  from public.saas_daily_usage u
  where u.user_id = v_user and u.usage_date = v_day;
  v_used := coalesce(v_used, 0);

  select coalesce(jsonb_object_agg(f.feature_key, f.enabled), '{}'::jsonb)
  into v_features
  from public.saas_plan_features f
  where f.plan_code = v_plan;
  if v_test_mode then
    select coalesce(jsonb_object_agg(f.feature_key,true),'{}'::jsonb)
    into v_features from public.saas_plan_features f;
  end if;

  return jsonb_build_object(
    'plan', v_plan, 'price_cents', v_price, 'currency', 'BRL',
    'daily_limit', v_limit, 'used_today', v_used,
    'remaining_today', greatest(v_limit - v_used, 0),
    'usage_date', v_day, 'features', v_features,
    'test_mode', v_test_mode
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.saas_my_feature_enabled(p_feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_plan_features f
    JOIN public.saas_plans p ON p.code = f.plan_code AND p.active
    WHERE f.feature_key = p_feature_key
      AND f.enabled
      AND f.plan_code = COALESCE((
        SELECT s.plan_code FROM public.saas_subscriptions s
        WHERE s.user_id = (SELECT auth.uid()) AND s.status = 'active'
          AND s.period_end > now()
      ), 'free')
      AND (SELECT auth.uid()) IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.private_access pa
    WHERE pa.user_id=(SELECT auth.uid()) AND pa.quota_test_mode=true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.saas_free_search_quota(p_user_id uuid, p_claim boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_plan text := 'free';
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_used integer := 0;
  v_granted boolean := false;
begin
  if p_user_id is null or not exists (
    select 1 from public.private_access where user_id = p_user_id
  ) then
    return null;
  end if;

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active = true
  where s.user_id = p_user_id and s.status = 'active'
    and s.period_end > now()
  order by s.period_end desc
  limit 1;
  v_plan := coalesce(v_plan, 'free');

  -- Single-user staging-only bypass. No INSERT/UPDATE on daily search counters.
  if exists(select 1 from public.private_access pa
            where pa.user_id=p_user_id and pa.quota_test_mode=true) then
    return jsonb_build_object(
      'plan',v_plan,'daily_limit',case when v_plan='free' then 3 else null end,
      'used_today',case when v_plan='free' then 0 else null end,
      'remaining_today',case when v_plan='free' then 3 else null end,
      'usage_date',v_day,'max_results',20,'allowed',true,'reset_at',null,
      'test_mode',true
    );
  end if;

  if v_plan <> 'free' then
    return jsonb_build_object(
      'plan', v_plan, 'daily_limit', null, 'used_today', null,
      'remaining_today', null, 'usage_date', v_day, 'max_results', 20,
      'allowed', true, 'reset_at', null
    );
  end if;

  if coalesce(p_claim, false) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('januario-free-search'),
      pg_catalog.hashtext(p_user_id::text)
    );
    insert into public.saas_daily_search_usage(user_id, usage_date, used)
    values (p_user_id, v_day, 1)
    on conflict (user_id, usage_date) do update
      set used = public.saas_daily_search_usage.used + 1,
          updated_at = now()
    where public.saas_daily_search_usage.used < 3
    returning used into v_used;
    v_granted := found;
    if not v_granted then
      select used into v_used from public.saas_daily_search_usage
      where user_id = p_user_id and usage_date = v_day;
    end if;
  else
    select used into v_used from public.saas_daily_search_usage
    where user_id = p_user_id and usage_date = v_day;
    v_granted := coalesce(v_used, 0) < 3;
  end if;

  v_used := coalesce(v_used, 0);
  return jsonb_build_object(
    'plan', 'free', 'daily_limit', 3,
    'used_today', v_used, 'remaining_today', greatest(3 - v_used, 0),
    'usage_date', v_day, 'max_results', 20, 'allowed', v_granted,
    'reset_at', ((v_day + 1)::timestamp at time zone 'America/Sao_Paulo')
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.peek_daily_leads_for_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_plan text := 'free';
  v_limit integer;
  v_used integer := 0;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_enrichment boolean := false;
begin
  if p_user_id is null or not exists (
    select 1 from public.private_access pa where pa.user_id = p_user_id
  ) then
    return null;
  end if;

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active
  where s.user_id = p_user_id
    and s.status = 'active'
    and s.period_end > now();
  v_plan := coalesce(v_plan, 'free');

  select p.daily_lead_limit into v_limit
  from public.saas_plans p
  where p.code = v_plan and p.active;
  if v_limit is null then return null; end if;

  -- Staging tester gets an uncharged search budget; external API spend guards
  -- remain enforced by the Edge Functions, independent of this wallet.
  if exists(select 1 from public.private_access pa
            where pa.user_id=p_user_id and pa.quota_test_mode=true) then
    return jsonb_build_object(
      'plan',v_plan,'daily_limit',1000000,'used_today',0,
      'remaining_today',1000000,'usage_date',v_day,
      'lead_enrichment',true,'test_mode',true
    );
  end if;

  select coalesce(u.used, 0) into v_used
  from public.saas_daily_usage u
  where u.user_id = p_user_id and u.usage_date = v_day;
  v_used := coalesce(v_used, 0);

  select coalesce(f.enabled, false) into v_enrichment
  from public.saas_plan_features f
  where f.plan_code = v_plan and f.feature_key = 'lead_enrichment';

  return jsonb_build_object(
    'plan', v_plan,
    'daily_limit', v_limit,
    'used_today', v_used,
    'remaining_today', greatest(v_limit - v_used, 0),
    'usage_date', v_day,
    'lead_enrichment', coalesce(v_enrichment, false)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_daily_leads_for_user_with_aliases(p_user_id uuid, p_place_ids text[], p_source text, p_aliases jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_alias text;
  v_paid text;
  v_count integer := 0;
  v_test_ids text[] := array[]::text[];
  v_test_id text;
  v_test_plan text := 'free';
begin
  if p_user_id is null or p_place_ids is null or cardinality(p_place_ids)>100
    or p_source not in ('search','maps')
    or p_aliases is null or jsonb_typeof(p_aliases)<>'object'
    or (select count(*) from jsonb_object_keys(p_aliases))>100
    or not exists(select 1 from public.private_access where user_id=p_user_id) then
    raise exception 'Invalid alias claim' using errcode='22023';
  end if;

  -- Staging-only test mode: return real provider IDs without recording a
  -- charge, an unlock or an alias in any daily ledger. Provider API budgets
  -- and request-rate limits are checked separately by Edge Functions.
  if exists(select 1 from public.private_access pa
            where pa.user_id=p_user_id and pa.quota_test_mode=true) then
    select s.plan_code into v_test_plan
      from public.saas_subscriptions s
      join public.saas_plans p on p.code=s.plan_code and p.active=true
      where s.user_id=p_user_id and s.status='active' and s.period_end>now()
      order by s.period_end desc limit 1;
    v_test_plan:=coalesce(v_test_plan,'free');
    foreach v_test_id in array p_place_ids loop
      v_test_id:=btrim(v_test_id);
      if v_test_id is null or length(v_test_id)<4 or length(v_test_id)>255
          or v_test_id=any(v_test_ids) then continue; end if;
      v_test_ids:=array_append(v_test_ids,v_test_id);
    end loop;
    return jsonb_build_object(
      'plan',v_test_plan,'daily_limit',1000000,'used_today',0,
      'remaining_today',1000000,'newly_unlocked',0,'credits_spent',0,
      'credit_cost',case when p_source='maps' then 2 else 1 end,
      'allowed_place_ids',to_jsonb(v_test_ids),'usage_date',v_date,
      'test_mode',true
    );
  end if;

  -- This row serializes claims and aliases together per user/day.
  insert into public.saas_daily_usage(user_id,usage_date,used)
    values(p_user_id,v_date,0) on conflict(user_id,usage_date) do nothing;
  perform 1 from public.saas_daily_usage
    where user_id=p_user_id and usage_date=v_date for update;

  for v_alias,v_paid in select key,value from jsonb_each_text(p_aliases) loop
    if length(v_alias)<4 or length(v_alias)>255
       or v_alias <> all(p_place_ids)
       or v_alias=v_paid
       or (v_alias like 'geoapify:%')=(v_paid like 'geoapify:%') then
      continue;
    end if;
    if exists(select 1 from public.saas_daily_credit_leads d
      where d.user_id=p_user_id and d.usage_date=v_date and d.place_id=v_paid) then
      insert into public.saas_daily_credit_leads
        (user_id,usage_date,place_id,source,charged_credits)
      values(p_user_id,v_date,v_alias,p_source,0)
      on conflict(user_id,usage_date,place_id) do nothing;
      v_count:=v_count+1;
    end if;
  end loop;
  return public.claim_daily_leads_for_user(p_user_id,p_place_ids,p_source);
end;
$function$
;
NOTIFY pgrst, 'reload schema';
