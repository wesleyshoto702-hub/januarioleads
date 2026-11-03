create table if not exists public.open_now_refresh_guard (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_key text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, location_key)
);

alter table public.open_now_refresh_guard enable row level security;

create or replace function public.claim_open_now_refresh(
  p_user_id uuid,
  p_location_key text,
  p_limit integer default 140,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.open_now_refresh_guard (
    user_id,
    location_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    p_user_id,
    p_location_key,
    now(),
    1,
    now()
  )
  on conflict (user_id, location_key)
  do update set
    window_started_at = case
      when public.open_now_refresh_guard.window_started_at <
        now() - make_interval(secs => p_window_seconds)
      then now()
      else public.open_now_refresh_guard.window_started_at
    end,
    request_count = case
      when public.open_now_refresh_guard.window_started_at <
        now() - make_interval(secs => p_window_seconds)
      then 1
      else public.open_now_refresh_guard.request_count + 1
    end,
    updated_at = now()
  returning request_count <= p_limit into allowed;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.claim_open_now_refresh(uuid,text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.claim_open_now_refresh(uuid,text,integer,integer)
  to service_role;
