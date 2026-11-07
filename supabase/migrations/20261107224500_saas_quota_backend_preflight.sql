-- Fase 2: preflight de leads SEM chamadas pagas.
-- Apenas backend service_role pode consultar as cotas de outros usuarios.
-- Em producao, aplicar somente depois de revisao da base SaaS.
create function public.peek_daily_leads_for_user(p_user_id uuid)
returns jsonb
language plpgsql
stable security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.peek_daily_leads_for_user(uuid)
  from public, anon, authenticated;
grant execute on function public.peek_daily_leads_for_user(uuid) to service_role;
