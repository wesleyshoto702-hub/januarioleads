-- Regression for Free: 3 searches/day; fourth denied.
-- STAGING ONLY. All writes are rolled back.
begin;
do $$
declare
  v_user uuid;
  v_one jsonb;
  v_two jsonb;
  v_three jsonb;
  v_four jsonb;
  v_peek jsonb;
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select user_id into v_user from public.private_access limit 1;
  if v_user is null then raise exception 'No authorized staging test user'; end if;
  delete from public.saas_daily_search_usage
    where user_id=v_user and usage_date=v_date;
  v_peek := public.saas_free_search_quota(v_user,false);
  if v_peek->>'plan' <> 'free' or
     (v_peek->>'remaining_today')::int <> 3 then
    raise exception 'Expected 3 free searches before claims: %',v_peek;
  end if;
  v_one := public.saas_free_search_quota(v_user,true);
  v_two := public.saas_free_search_quota(v_user,true);
  v_three := public.saas_free_search_quota(v_user,true);
  v_four := public.saas_free_search_quota(v_user,true);

  if v_one->>'allowed' <> 'true' or
     v_two->>'allowed' <> 'true' or
     v_three->>'allowed' <> 'true' or
     v_four->>'allowed' <> 'false' or
     (v_three->>'remaining_today')::int <> 0 or
     (v_four->>'used_today')::int <> 3 or
     (v_four->>'max_results')::int <> 20 then
    raise exception 'Free quota failed: %,%,%,%',v_one,v_two,v_three,v_four;
  end if;
  if (public.saas_free_search_quota(v_user,false)->>'used_today')::int <> 3 then
    raise exception 'Read-only status changed the counter';
  end if;
end $$;
rollback;
do $$
begin
  if has_function_privilege('authenticated',
        'public.saas_free_search_quota(uuid,boolean)','execute') then
    raise exception 'Authenticated clients must not claim Free quota';
  end if;
  if not has_function_privilege('service_role',
        'public.saas_free_search_quota(uuid,boolean)','execute') then
    raise exception 'Server must be able to claim Free quota';
  end if;
end $$;
