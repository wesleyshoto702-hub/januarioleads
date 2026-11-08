-- Rollback-only. No user credits or CRM records are committed.
begin;
do $$
declare
  u uuid;
  seed text:=replace(gen_random_uuid()::text,'-','');
  osm text;
  google text;
  next_osm text;
  next_google text;
  unused text;
  r jsonb;
  n integer;
  pro_blocked boolean:=false;
begin
  select user_id into u from public.private_access limit 1;
  if u is null then raise exception 'Missing staging test identity'; end if;
  insert into public.saas_subscriptions(user_id,plan_code,status,period_start,period_end)
    values(u,'advanced','active',now()-interval '1 day',now()+interval '1 day')
    on conflict(user_id) do update set plan_code='advanced',status='active',
      period_start=excluded.period_start,period_end=excluded.period_end;
  osm:='geoapify:'||seed;
  google:='ChIJgoogle'||seed;
  next_osm:='geoapify:second'||seed;
  next_google:='ChIJother'||seed;
  unused:='geoapify:unverified'||seed;

  -- Geoapify first: 2 credits, OSM anchor saved atomically.
  r:=public.claim_daily_maps_with_osm_anchors(u,array[osm],'{}'::jsonb,
    jsonb_build_array(jsonb_build_object('sourceId',osm,
      'name','Barbearia São José','address','Rua das Flores, 22',
      'city','Lavras','state','MG','latitude',-21.2455,'longitude',-44.9982)));
  if (r->>'credits_spent')::int<>2 then raise exception 'OSM first debit: %',r;end if;
  select count(*) into n from public.saas_daily_geoapify_anchors
    where user_id=u and place_id=osm;
  if n<>1 then raise exception 'OSM anchor not recorded';end if;

  -- Later Google search already paid under OSM ID: zero incremental credits.
  r:=public.claim_daily_leads_for_user_with_aliases(
    u,array[google],'search',jsonb_build_object(google,osm));
  if (r->>'credits_spent')::int<>0 or (r->>'remaining_today')::int<>68
    then raise exception 'OSM-to-Google double bill: %',r; end if;

  -- Reverse direction on another venue: Google billed first at one credit.
  r:=public.claim_daily_leads_for_user(u,array[next_google],'search');
  if (r->>'credits_spent')::int<>1 then raise exception 'Google-first debit: %',r;end if;
  r:=public.claim_daily_maps_with_osm_anchors(
    u,array[next_osm],jsonb_build_object(next_osm,next_google),
    jsonb_build_array(jsonb_build_object('sourceId',next_osm,
      'name','Clínica Outro Teste','address','Rua Centro 11',
      'city','Lavras','state','MG','latitude',-21.245,'longitude',-44.99)));
  if (r->>'credits_spent')::int<>0 or (r->>'remaining_today')::int<>67
    then raise exception 'Google-to-OSM double bill: %',r;end if;

  -- A forged/missing alias target must NOT waive a charge.
  r:=public.claim_daily_leads_for_user_with_aliases(
    u,array[unused],'maps',jsonb_build_object(unused,'never-paid-id'));
  if (r->>'credits_spent')::int<>2
    then raise exception 'Unverified cross-source alias not charged: %',r;end if;

  -- Standard 3-argument recheck must see all charged/aliased IDs.
  r:=public.claim_daily_leads_for_user(u,array[google,next_osm],'search');
  if (r->>'credits_spent')::int<>0
    then raise exception 'Recorded aliases charged on revisit: %',r;end if;

  -- A Pro request must not bypass Maps entitlements via verified alias.
  update public.saas_subscriptions set plan_code='pro' where user_id=u;
  begin
    perform public.claim_daily_maps_with_osm_anchors(u,array[osm],
      '{}'::jsonb,'[]'::jsonb);
  exception when insufficient_privilege then pro_blocked:=true;
  end;
  if not pro_blocked then raise exception 'Pro gate bypassed';end if;
end $$;
rollback;
