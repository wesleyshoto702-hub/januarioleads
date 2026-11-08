-- Free prospecting: 3 initial searches/day (America/Sao_Paulo), at most 20 results/search.
-- Intentionally independent from the existing daily *contact/lead unlock* allowance.
create table if not exists public.saas_daily_search_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
alter table public.saas_daily_search_usage enable row level security;
revoke all on public.saas_daily_search_usage from public, anon, authenticated;
grant select on public.saas_daily_search_usage to authenticated;
drop policy if exists saas_search_usage_own_read on public.saas_daily_search_usage;
create policy saas_search_usage_own_read on public.saas_daily_search_usage
  for select to authenticated using ((select auth.uid()) = user_id);

-- Called only by an authenticated Edge Function using its server-only service credential.
-- p_claim=false checks remaining searches without spending a call; p_claim=true
-- atomically spends one initial query only for the Free plan.
create or replace function public.saas_free_search_quota(
  p_user_id uuid,
  p_claim boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
$$;
revoke all on function public.saas_free_search_quota(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.saas_free_search_quota(uuid, boolean)
  to service_role;
