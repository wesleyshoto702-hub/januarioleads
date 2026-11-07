-- Januário Leads: consulta de saldo para a Edge Function.
-- Serviço somente. A leitura do usuário permanece em get_my_saas_entitlements().
create function public.peek_daily_leads_for_user(p_user_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_plan text := 'free';
  v_limit integer;
  v_used integer := 0;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_user_id is null then
    return null;
  end if;

  -- A autorização do CRM é validada antes pela Edge Function.
  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active = true
  where s.user_id = p_user_id
    and s.status = 'active'
    and s.period_end > now();
  v_plan := coalesce(v_plan, 'free');

  select p.daily_lead_limit into v_limit
  from public.saas_plans p where p.code = v_plan and p.active = true;
  if v_limit is null then
    return null;
  end if;

  select coalesce(u.used,0) into v_used
  from public.saas_daily_usage u
  where u.user_id = p_user_id and u.usage_date = v_day;

  v_used := coalesce(v_used,0);
  return jsonb_build_object(
    'plan', v_plan,
    'daily_limit', v_limit,
    'used_today', v_used,
    'remaining_today', greatest(v_limit-v_used,0),
    'usage_date', v_day
  );
end;
$$;

revoke all on function public.peek_daily_leads_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.peek_daily_leads_for_user(uuid)
  to service_role;
