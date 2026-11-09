-- Correct 3-arg credit RPC after staging migration; no new data changes.
create or replace function public.claim_daily_leads_for_user(
  p_user_id uuid, p_place_ids text[], p_source text
) returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_plan text := 'free';
  v_limit integer;
  v_used integer;
  v_id text;
  v_seen text[] := array[]::text[];
  v_allowed text[] := array[]::text[];
  v_inserted integer;
  v_new integer := 0;
  v_spent integer := 0;
  v_cost integer;
begin
  if p_user_id is null or p_place_ids is null or p_source not in ('search','maps')
     or cardinality(p_place_ids) > 100 or
     not exists (select 1 from public.private_access pa where pa.user_id=p_user_id) then
    raise exception 'Invalid credit claim request' using errcode='22023';
  end if;

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code=s.plan_code and p.active=true
  where s.user_id=p_user_id and s.status='active' and s.period_end>now();
  v_plan := coalesce(v_plan,'free');
  select p.daily_lead_limit into v_limit
  from public.saas_plans p where p.code=v_plan and p.active=true;
  if v_limit is null then
    raise exception 'Invalid plan for credit claim' using errcode='22023';
  end if;
  if p_source='maps' and v_plan <> 'advanced' then
    raise exception 'Maps credits require Advanced' using errcode='42501';
  end if;
  v_cost := case when p_source='maps' then 2 else 1 end;

  -- Per-user/day row lock makes multi-request credit debits atomic and
  -- prevents two concurrent searches from spending the same last credits.
  insert into public.saas_daily_usage(user_id,usage_date,used)
  values (p_user_id,v_day,0) on conflict (user_id,usage_date) do nothing;
  select u.used into v_used from public.saas_daily_usage u
    where u.user_id=p_user_id and u.usage_date=v_day for update;

  foreach v_id in array p_place_ids loop
    v_id := btrim(v_id);
    if v_id is null or length(v_id)<4 or length(v_id)>255
       or v_id=any(v_seen) then continue; end if;
    v_seen := array_append(v_seen,v_id);

    if exists (select 1 from public.saas_daily_credit_leads d
      where d.user_id=p_user_id and d.usage_date=v_day and d.place_id=v_id) then
      v_allowed := array_append(v_allowed,v_id);
    elsif v_used + v_cost <= v_limit then
      insert into public.saas_daily_credit_leads(user_id,usage_date,place_id,source,charged_credits)
      values(p_user_id,v_day,v_id,p_source,v_cost)
      on conflict(user_id,usage_date,place_id) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted=1 then
        v_used := v_used + v_cost;
        v_new := v_new+1;
        v_spent := v_spent+v_cost;
        v_allowed := array_append(v_allowed,v_id);
      end if;
    end if;
  end loop;

  update public.saas_daily_usage
     set used=v_used,updated_at=now()
   where user_id=p_user_id and usage_date=v_day;

  -- Keep the existing lifetime-unlocked metadata for compatibility.
  insert into public.saas_lead_unlocks(user_id,place_id,unlocked_on)
  select p_user_id,item.place_key,v_day
  from unnest(v_allowed) as item(place_key)
  on conflict(user_id,place_id) do nothing;

  return jsonb_build_object(
    'plan',v_plan,'daily_limit',v_limit,'used_today',v_used,
    'remaining_today',greatest(v_limit-v_used,0),
    'newly_unlocked',v_new,'credits_spent',v_spent,
    'credit_cost',v_cost,'allowed_place_ids',to_jsonb(v_allowed),
    'usage_date',v_day
  );
end;
$$;;
notify pgrst, 'reload schema';
