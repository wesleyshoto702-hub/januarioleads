-- STAGING ONLY: verified equivalences between Google Place IDs and OSM IDs.
-- Never stores Google names, addresses, geocoordinates or derived fingerprints.
-- OSM data in geoapify anchors is independently licensed; keep OSM attribution.
-- Only privileged Edge routes can claim verified aliases, not browser clients.

create table if not exists public.saas_daily_geoapify_anchors (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  place_id text not null check (place_id ~ '^geoapify:[a-zA-Z0-9]{4,240}$'),
  name text not null check (length(name) between 2 and 200),
  address text,
  city text not null,
  state text not null check (state ~ '^[A-Z]{2}$'),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id,usage_date,place_id)
);
alter table public.saas_daily_geoapify_anchors enable row level security;
revoke all on public.saas_daily_geoapify_anchors from public,anon,authenticated;
grant select,insert,update,delete on public.saas_daily_geoapify_anchors to service_role;
create index if not exists saas_daily_geoapify_anchors_user_day_idx
  on public.saas_daily_geoapify_anchors (user_id,usage_date);

-- A verified alias was already paid in another provider: zero *additional*
-- credits, but still tracked as an allowed result, with source + date.
alter table public.saas_daily_credit_leads
  drop constraint if exists saas_daily_credit_leads_charged_credits_check;
alter table public.saas_daily_credit_leads
  add constraint saas_daily_credit_leads_charged_credits_check
    check (charged_credits in (0,1,2));

create or replace function public.record_daily_geoapify_anchors_for_user(
  p_user_id uuid,p_places jsonb
) returns integer
language plpgsql volatile security invoker set search_path=''
as $$
declare
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  item jsonb;
  v_id text;
  v_lat double precision;
  v_lon double precision;
  v_n integer := 0;
begin
  if p_user_id is null or jsonb_typeof(p_places)<>'array' or
    jsonb_array_length(p_places)>35 or
    not exists(select 1 from public.private_access where user_id=p_user_id) then
    raise exception 'Invalid OSM anchor request' using errcode='22023';
  end if;
  -- Geoapify metadata may be retained only for the user's current day.
  delete from public.saas_daily_geoapify_anchors
    where usage_date < v_date - 1;
  for item in select value from jsonb_array_elements(p_places) loop
    v_id:=item->>'sourceId';
    if v_id is null or v_id !~ '^geoapify:[a-zA-Z0-9]{4,240}$'
      or length(coalesce(item->>'name','')) not between 2 and 200
      or length(coalesce(item->>'city',''))<2
      or (item->>'state') !~ '^[A-Z]{2}$'
      or jsonb_typeof(item->'latitude')<>'number'
      or jsonb_typeof(item->'longitude')<>'number' then
      continue;
    end if;
    v_lat:=(item->>'latitude')::double precision;
    v_lon:=(item->>'longitude')::double precision;
    if not (v_lat between -90 and 90 and v_lon between -180 and 180) then continue; end if;
    -- Persist only places that were actually delivered and charged (or aliased)
    -- by the credit wallet; this cannot be used to index unseen provider data.
    if not exists(select 1 from public.saas_daily_credit_leads d
      where d.user_id=p_user_id and d.usage_date=v_date and d.place_id=v_id) then
      continue;
    end if;
    insert into public.saas_daily_geoapify_anchors
      (user_id,usage_date,place_id,name,address,city,state,latitude,longitude)
    values
      (p_user_id,v_date,v_id,item->>'name',left(item->>'address',240),
       left(item->>'city',120),item->>'state',v_lat,v_lon)
    on conflict (user_id,usage_date,place_id) do update
      set name=excluded.name,address=excluded.address,city=excluded.city,
          state=excluded.state,latitude=excluded.latitude,
          longitude=excluded.longitude;
    v_n:=v_n+1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.record_daily_geoapify_anchors_for_user(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.record_daily_geoapify_anchors_for_user(uuid,jsonb)
  to service_role;

create or replace function public.get_daily_geoapify_anchors_for_user(
  p_user_id uuid
) returns jsonb language sql stable security invoker set search_path=''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceId',a.place_id,'name',a.name,'address',a.address,
    'city',a.city,'state',a.state,'latitude',a.latitude,'longitude',a.longitude
  )), '[]'::jsonb)
  from (select * from public.saas_daily_geoapify_anchors
    where user_id=p_user_id and
      usage_date=(now() at time zone 'America/Sao_Paulo')::date
    order by created_at desc limit 100) a;
$$;
revoke all on function public.get_daily_geoapify_anchors_for_user(uuid)
  from public,anon,authenticated;
grant execute on function public.get_daily_geoapify_anchors_for_user(uuid)
  to service_role;

create or replace function public.get_daily_google_credit_ids_for_user(
  p_user_id uuid
) returns jsonb language sql stable security invoker set search_path=''
as $$
  select coalesce(jsonb_agg(d.place_id),'[]'::jsonb)
  from (select place_id from public.saas_daily_credit_leads
    where user_id=p_user_id and
      usage_date=(now() at time zone 'America/Sao_Paulo')::date
      and place_id not like 'geoapify:%'
    order by created_at desc limit 100) d;
$$;
revoke all on function public.get_daily_google_credit_ids_for_user(uuid)
  from public,anon,authenticated;
grant execute on function public.get_daily_google_credit_ids_for_user(uuid)
  to service_role;

-- p_aliases is a server-VERIFIED map of current ID -> previously credited ID.
-- The RPC only trusts it when it points to an existing credit for this same
-- user and day, and the IDs belong to different providers.
-- No Google-derived metadata is stored; only exempt Google Place IDs and OSM IDs.
create or replace function public.claim_daily_leads_for_user_with_aliases(
  p_user_id uuid,p_place_ids text[],p_source text,p_aliases jsonb
) returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare
  v_date date := (now() at time zone 'America/Sao_Paulo')::date;
  v_alias text;
  v_paid text;
  v_count integer := 0;
begin
  if p_user_id is null or p_place_ids is null or cardinality(p_place_ids)>100
    or p_source not in ('search','maps')
    or p_aliases is null or jsonb_typeof(p_aliases)<>'object'
    or (select count(*) from jsonb_object_keys(p_aliases))>100
    or not exists(select 1 from public.private_access where user_id=p_user_id) then
    raise exception 'Invalid alias claim' using errcode='22023';
  end if;

  -- This row serializes claims and aliases together per user/day.
  insert into public.saas_daily_usage(user_id,usage_date,used)
    values(p_user_id,v_date,0) on conflict(user_id,usage_date) do nothing;
  perform 1 from public.saas_daily_usage
    where user_id=p_user_id and usage_date=v_date for update;

  for v_alias,v_paid in select key,value from jsonb_each_text(p_aliases) loop
    if length(v_alias)<4 or length(v_alias)>255
       or v_alias <> all(p_place_ids)
       or v_alias=v_paid
       or (v_alias like 'geoapify:%')=(v_paid like 'geoapify:%') then
      continue;
    end if;
    if exists(select 1 from public.saas_daily_credit_leads d
      where d.user_id=p_user_id and d.usage_date=v_date and d.place_id=v_paid) then
      insert into public.saas_daily_credit_leads
        (user_id,usage_date,place_id,source,charged_credits)
      values(p_user_id,v_date,v_alias,p_source,0)
      on conflict(user_id,usage_date,place_id) do nothing;
      v_count:=v_count+1;
    end if;
  end loop;
  return public.claim_daily_leads_for_user(p_user_id,p_place_ids,p_source);
end;
$$;
revoke all on function public.claim_daily_leads_for_user_with_aliases(uuid,text[],text,jsonb)
  from public,anon,authenticated;
grant execute on function public.claim_daily_leads_for_user_with_aliases(uuid,text[],text,jsonb)
  to service_role;
notify pgrst, 'reload schema';
