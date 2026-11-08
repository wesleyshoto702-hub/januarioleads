-- STAGING. Keep cross-provider duplicate recognition after the daily wallet resets.
-- Persist only Google Place IDs in Google records. OSM/Geoapify CRM metadata
-- is independently licensed and already part of the user's saved CRM record.
-- The zero-credit alias rule remains SAME-DAY ONLY in the separate claim RPC.

create or replace function public.get_daily_geoapify_anchors_for_user(
  p_user_id uuid
) returns jsonb language sql stable security invoker set search_path=''
as $$
  with candidates as (
    select a.place_id,a.name,a.address,a.city,a.state,
           a.latitude,a.longitude,a.created_at as seen_at
      from public.saas_daily_geoapify_anchors a
     where a.user_id=p_user_id and
           a.usage_date=(now() at time zone 'America/Sao_Paulo')::date
    union all
    select l.place_id,l.company as name,l.address,l.city,l.state,
           l.latitude,l.longitude,l.created_at as seen_at
      from public.leads l
     where l.user_id=p_user_id and l.place_id like 'geoapify:%'
       and l.latitude between -90 and 90
       and l.longitude between -180 and 180
       and length(coalesce(l.company,'')) between 2 and 200
       and length(coalesce(l.city,'')) >=2
       and length(coalesce(l.state,''))=2
  ),
  deduplicated as (
    select distinct on (place_id) *
      from candidates order by place_id,seen_at desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceId',x.place_id,'name',x.name,'address',x.address,
    'city',x.city,'state',x.state,
    'latitude',x.latitude,'longitude',x.longitude
  )), '[]'::jsonb)
  from (select * from deduplicated order by seen_at desc limit 100) x;
$$;
revoke all on function public.get_daily_geoapify_anchors_for_user(uuid)
  from public,anon,authenticated;
grant execute on function public.get_daily_geoapify_anchors_for_user(uuid)
  to service_role;

create or replace function public.get_daily_google_credit_ids_for_user(
  p_user_id uuid
) returns jsonb language sql stable security invoker set search_path=''
as $$
  with candidates as (
    select d.place_id, d.created_at as seen_at
      from public.saas_daily_credit_leads d
     where d.user_id=p_user_id and
       d.usage_date=(now() at time zone 'America/Sao_Paulo')::date
       and d.place_id not like 'geoapify:%'
    union all
    select l.place_id, l.created_at as seen_at
      from public.leads l
     where l.user_id=p_user_id and l.place_id is not null
       and length(l.place_id) between 4 and 255
       and l.place_id not like 'geoapify:%'
  ),
  deduplicated as (
    select place_id,max(seen_at) as last_seen
      from candidates group by place_id
  )
  select coalesce(jsonb_agg(x.place_id),'[]'::jsonb)
    from (select place_id from deduplicated order by last_seen desc limit 100) x;
$$;
revoke all on function public.get_daily_google_credit_ids_for_user(uuid)
  from public,anon,authenticated;
grant execute on function public.get_daily_google_credit_ids_for_user(uuid)
  to service_role;
notify pgrst, 'reload schema';
