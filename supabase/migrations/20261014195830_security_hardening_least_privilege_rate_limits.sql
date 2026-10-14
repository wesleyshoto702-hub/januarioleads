create table if not exists public.api_request_rate_limit (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, bucket),
  constraint api_request_rate_limit_bucket_check
    check (bucket in ('places_search','lead_enrichment','presence_discovery','deep_enrichment')),
  constraint api_request_rate_limit_count_check
    check (request_count >= 0)
);

alter table public.api_request_rate_limit enable row level security;

revoke all privileges on table public.api_request_rate_limit
  from public, anon, authenticated;
grant select, insert, update, delete on table public.api_request_rate_limit
  to service_role;

create or replace function public.claim_api_request(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer := 900;
  v_allowed boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.private_access pa
    where pa.user_id = v_user_id
  ) then
    return false;
  end if;

  v_limit := case p_bucket
    when 'places_search' then 90
    when 'lead_enrichment' then 30
    when 'presence_discovery' then 20
    when 'deep_enrichment' then 12
    else null
  end;

  if v_limit is null then
    return false;
  end if;

  insert into public.api_request_rate_limit (
    user_id,
    bucket,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    v_user_id,
    p_bucket,
    now(),
    1,
    now()
  )
  on conflict (user_id, bucket)
  do update set
    window_started_at = case
      when public.api_request_rate_limit.window_started_at <
        now() - make_interval(secs => v_window_seconds)
      then now()
      else public.api_request_rate_limit.window_started_at
    end,
    request_count = case
      when public.api_request_rate_limit.window_started_at <
        now() - make_interval(secs => v_window_seconds)
      then 1
      else public.api_request_rate_limit.request_count + 1
    end,
    updated_at = now()
  returning request_count <= v_limit into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.claim_api_request(text)
  from public, anon;
grant execute on function public.claim_api_request(text)
  to authenticated, service_role;

revoke all privileges on table public.leads from anon, authenticated;
grant select, insert, update, delete on table public.leads to authenticated;

revoke all privileges on table public.lead_activities from anon, authenticated;
grant select, insert, update, delete on table public.lead_activities to authenticated;

revoke all privileges on table public.lead_payments from anon, authenticated;
grant select, insert on table public.lead_payments to authenticated;

revoke all privileges on table public.lead_updates from anon, authenticated;
grant select on table public.lead_updates to authenticated;
grant update (is_seen) on table public.lead_updates to authenticated;

revoke all privileges on table public.private_access from anon, authenticated;
grant select on table public.private_access to authenticated;

revoke all privileges on table public.places_search_cache from anon, authenticated;
grant select, insert, update on table public.places_search_cache to authenticated;

revoke all privileges on table public.open_now_niche_cache from anon, authenticated;
grant select on table public.open_now_niche_cache to authenticated;

revoke all privileges on table public.open_now_refresh_guard from anon, authenticated;

revoke all privileges on table public.business_enrichment_runs from anon, authenticated;
revoke all privileges on table public.business_enrichment_sources from anon, authenticated;
revoke all privileges on table public.business_enrichment_facts from anon, authenticated;

revoke all privileges on table public.site_previews from anon, authenticated;
revoke all privileges on table public.prompt_visual_reference_sets from anon, authenticated;
revoke all privileges on table public.prompt_visual_references from anon, authenticated;
revoke all privileges on table public.prompt_visual_reference_assets from anon, authenticated;
