-- Geoapify preparation only. Disabled by default. Staging first; no provider calls.
-- Budget scope is independent of existing Google Places safety caps.
create table if not exists public.saas_geoapify_api_limits (
  operation text primary key check (operation in ('geocode','places')),
  enabled boolean not null default false,
  daily_project integer not null check (daily_project between 1 and 3000),
  monthly_project integer not null check (monthly_project >= daily_project),
  daily_user integer not null check (daily_user between 1 and 100),
  updated_at timestamptz not null default now()
);
alter table public.saas_geoapify_api_limits enable row level security;
revoke all on public.saas_geoapify_api_limits from public, anon, authenticated;

insert into public.saas_geoapify_api_limits
  (operation, enabled, daily_project, monthly_project, daily_user)
values
  ('geocode', false, 100, 2000, 15),
  ('places', false, 100, 2000, 15)
on conflict (operation) do nothing;

create table if not exists public.saas_geoapify_api_usage (
  operation text not null references public.saas_geoapify_api_limits(operation),
  scope text not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (operation, scope)
);
alter table public.saas_geoapify_api_usage enable row level security;
revoke all on public.saas_geoapify_api_usage from public, anon, authenticated;

-- Only privileged Edge Functions may reserve a credit.
-- Serializable per operation, with daily/project/monthly and per-user caps.
create or replace function public.claim_saas_geoapify_api_budget(
  p_user_id uuid, p_operation text
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_limits public.saas_geoapify_api_limits%rowtype;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_month date := date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
  v_global_day text;
  v_global_month text;
  v_user_day text;
  v_daily integer;
  v_monthly integer;
  v_user integer;
begin
  if p_user_id is null or p_operation not in ('geocode', 'places') or
     not exists (select 1 from public.private_access where user_id = p_user_id) then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('januario-geoapify'),
    pg_catalog.hashtext(p_operation)
  );

  select * into v_limits from public.saas_geoapify_api_limits
  where operation = p_operation and enabled = true;
  if not found then return false; end if;

  v_global_day := 'global:day:' || v_today::text;
  v_global_month := 'global:month:' || v_month::text;
  v_user_day := 'user:' || p_user_id::text || ':day:' || v_today::text;

  select coalesce((select request_count from public.saas_geoapify_api_usage
    where operation = p_operation and scope = v_global_day), 0) into v_daily;
  select coalesce((select request_count from public.saas_geoapify_api_usage
    where operation = p_operation and scope = v_global_month), 0) into v_monthly;
  select coalesce((select request_count from public.saas_geoapify_api_usage
    where operation = p_operation and scope = v_user_day), 0) into v_user;

  if v_daily >= v_limits.daily_project or
     v_monthly >= v_limits.monthly_project or
     v_user >= v_limits.daily_user then return false; end if;

  insert into public.saas_geoapify_api_usage(operation,scope,request_count)
  values(p_operation,v_global_day,1),(p_operation,v_global_month,1),
        (p_operation,v_user_day,1)
  on conflict (operation,scope) do update set
    request_count = public.saas_geoapify_api_usage.request_count + 1,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.claim_saas_geoapify_api_budget(uuid,text)
  from public, anon, authenticated;
grant execute on function public.claim_saas_geoapify_api_budget(uuid,text)
  to service_role;
