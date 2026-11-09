-- STAGING ONLY. Exercises credits against an authorized staging user and
-- rolls back EVERY insert/credit, including the temporary plan fixture.
begin;
do $$
declare
  u uuid;
  marker text := gen_random_uuid()::text;
  r jsonb;
  entries text[];
  unauthorized boolean := false;
begin
  select user_id into u from public.private_access limit 1;
  if u is null then raise exception 'No authorized staging test user'; end if;
  insert into public.saas_subscriptions(user_id,plan_code,status,period_start,period_end)
    values(u,'advanced','active',now()-interval '1 day',now()+interval '1 day')
    on conflict(user_id) do update
      set plan_code='advanced', status='active',
          period_start=excluded.period_start, period_end=excluded.period_end;

  r := public.claim_daily_leads_for_user(u,array['search-1-'||marker,'search-2-'||marker],'search');
  if (r->>'credits_spent')::int <> 2 or (r->>'remaining_today')::int <> 68
    then raise exception 'One credit per traditional lead: %',r; end if;
  r := public.claim_daily_leads_for_user(u,array['search-1-'||marker],'maps');
  if (r->>'credits_spent')::int <> 0 or (r->>'remaining_today')::int <> 68
    then raise exception 'Same-day repeat was billed: %',r; end if;
  r := public.claim_daily_leads_for_user(u,array['maps-1-'||marker,'maps-2-'||marker],'maps');
  if (r->>'credits_spent')::int <> 4 or (r->>'remaining_today')::int <> 64
    then raise exception 'Two credits per Maps lead: %',r; end if;
  r := public.claim_daily_leads_for_user(u,array[]::text[],'maps');
  if (r->>'credits_spent')::int <> 0 or (r->>'remaining_today')::int <> 64
    then raise exception 'No-results fee charged: %',r; end if;
  select array_agg('map-final-'||n::text||'-'||marker)
    into entries from generate_series(1,36) as n;
  r := public.claim_daily_leads_for_user(u,entries,'maps');
  if (r->>'remaining_today')::int <> 0 or (r->>'credits_spent')::int <> 64 or
     jsonb_array_length(r->'allowed_place_ids') <> 32
    then raise exception 'Wallet overdraft: %',r; end if;
  r := public.claim_daily_leads_for_user(u,array['extra-'||marker],'maps');
  if (r->>'credits_spent')::int <> 0 or (r->>'remaining_today')::int <> 0
    then raise exception 'Empty wallet charged: %',r; end if;
  update public.saas_subscriptions set plan_code='pro' where user_id=u;
  begin
    perform public.claim_daily_leads_for_user(u,array['blocked-'||marker],'maps');
  exception when insufficient_privilege then unauthorized := true;
  end;
  if not unauthorized then raise exception 'Pro Maps was allowed'; end if;
end $$;
rollback;
