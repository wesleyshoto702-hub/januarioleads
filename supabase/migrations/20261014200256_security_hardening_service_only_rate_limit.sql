create or replace function public.claim_api_request_for_user(
  p_user_id uuid,
  p_bucket text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_window_seconds integer := 900;
  v_allowed boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.private_access pa
    where pa.user_id = p_user_id
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
    p_user_id,
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

revoke all on function public.claim_api_request_for_user(uuid,text)
  from public, anon, authenticated;
grant execute on function public.claim_api_request_for_user(uuid,text)
  to service_role;
