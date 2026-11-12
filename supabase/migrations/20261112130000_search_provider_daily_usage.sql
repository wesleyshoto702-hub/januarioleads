-- Global, atomic day-scoped caps for optional external search providers.
-- A free/open Overture lookup never consumes this counter.
-- Execution is service_role-only; browser roles cannot inspect or increase caps.
create table if not exists public.search_provider_daily_usage (
  provider text not null check (provider in ('geoapify', 'google_places')),
  day date not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (provider, day)
);
alter table public.search_provider_daily_usage enable row level security;
revoke all on table public.search_provider_daily_usage from public, anon, authenticated;
grant select, insert, update on table public.search_provider_daily_usage to service_role;

create or replace function public.claim_search_provider_call(
  p_provider text, p_daily_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if p_provider not in ('geoapify', 'google_places')
     or p_daily_limit is null
     or p_daily_limit < 1
     or p_daily_limit > 500 then
    return false;
  end if;

  insert into public.search_provider_daily_usage (provider, day, calls)
  values (p_provider, (now() at time zone 'UTC')::date, 1)
  on conflict (provider, day)
  do update
    set calls = public.search_provider_daily_usage.calls + 1
    where public.search_provider_daily_usage.calls < p_daily_limit
  returning calls into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function public.claim_search_provider_call(text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_search_provider_call(text, integer)
  to service_role;
