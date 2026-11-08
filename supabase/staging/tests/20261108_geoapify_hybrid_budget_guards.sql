-- STAGING ONLY: this test intentionally rolls back the temporary enablement and counters.
begin;
do $$
declare
  v_user uuid;
  v_i integer;
begin
  select user_id into v_user from public.private_access limit 1;
  if v_user is null then raise exception 'Staging account not found'; end if;
  if exists(select 1 from public.saas_geoapify_api_limits where enabled) then
    raise exception 'Geoapify should be disabled by default';
  end if;
  if public.claim_saas_geoapify_api_budget(v_user,'places') then
    raise exception 'Disabled provider incorrectly granted credit';
  end if;

  update public.saas_geoapify_api_limits set enabled=true;
  if not public.claim_saas_geoapify_api_budget(v_user,'places') or
     not public.claim_saas_geoapify_api_budget(v_user,'geocode') then
    raise exception 'Enabled transactional budgets failed';
  end if;
  if public.claim_saas_geoapify_api_budget(v_user,'unapproved-operation') then
    raise exception 'Unexpected operation granted';
  end if;

  update public.saas_geoapify_request_window
  set used=0, window_started_at=date_trunc('second',now()) where id=true;
  for v_i in 1..4 loop
    if not public.claim_saas_geoapify_request_slot(v_user) then
      raise exception 'Request % should be allowed',v_i;
    end if;
  end loop;
  if public.claim_saas_geoapify_request_slot(v_user) then
    raise exception 'Fifth call in the second bypassed the 4/s cap';
  end if;
end $$;
rollback;

do $$
begin
  if exists (select 1 from public.saas_geoapify_api_limits where enabled) then
    raise exception 'Test left Geoapify enabled';
  end if;
  if exists (select 1 from public.saas_geoapify_api_usage) then
    raise exception 'Test left paid API credit events';
  end if;
  if has_function_privilege('authenticated',
      'public.claim_saas_geoapify_api_budget(uuid,text)', 'execute') or
     has_function_privilege('authenticated',
      'public.claim_saas_geoapify_request_slot(uuid)', 'execute') then
    raise exception 'Authenticated clients must not call privileged budget functions';
  end if;
end $$;
