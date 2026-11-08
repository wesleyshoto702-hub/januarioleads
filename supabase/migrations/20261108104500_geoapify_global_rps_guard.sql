-- Cross-operation burst control for Geoapify Free's 5 requests/sec.
-- At most FOUR outbound API calls per second across geocoding and Places.
create table if not exists public.saas_geoapify_request_window (
  id boolean primary key default true check (id = true),
  window_started_at timestamptz not null default date_trunc('second', now()),
  used integer not null default 0 check (used between 0 and 4)
);
alter table public.saas_geoapify_request_window enable row level security;
revoke all on public.saas_geoapify_request_window from public, anon, authenticated;
insert into public.saas_geoapify_request_window(id) values(true)
on conflict (id) do nothing;

create or replace function public.claim_saas_geoapify_request_slot(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim integer;
  v_now timestamptz := date_trunc('second', now());
begin
  if p_user_id is null or not exists (
    select 1 from public.private_access where user_id=p_user_id
  ) then return false; end if;

  update public.saas_geoapify_request_window
  set
    used = case
      when window_started_at < v_now then 1
      else used + 1
    end,
    window_started_at = case
      when window_started_at < v_now then v_now
      else window_started_at
    end
  where id=true and (
    window_started_at < v_now or used < 4
  )
  returning used into v_claim;

  return v_claim is not null and v_claim <= 4;
end;
$$;
revoke all on function public.claim_saas_geoapify_request_slot(uuid)
from public, anon, authenticated;
grant execute on function public.claim_saas_geoapify_request_slot(uuid)
to service_role;
