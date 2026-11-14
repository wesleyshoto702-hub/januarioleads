-- STAGING ONLY: 600k useful leads target, distinct from historical raw POI rows.
create or replace function public.overture_phase9_v5_status()
returns jsonb language sql stable security invoker
set search_path = ''
as $$
select jsonb_build_object(
  'total_companies', x.total_companies,
  'useful_companies', x.useful_companies,
  'overture_bytes',pg_total_relation_size('public.overture_places'::regclass),
  'database_bytes',pg_database_size(current_database())
)
from (
  select count(*)::bigint as total_companies,
  count(*) filter (
    where length(btrim(name)) >= 3
      and category is not null and btrim(category) <> ''
      and category not in (
        'river','lake','stream','waterfall','mountain','cave','island',
        'pond','reservoir','forest','wetland','beach','city','town',
        'village','municipality','county','state','country','natural_feature',
        'neighborhood','locality','park','public_plaza','town_hall',
        'government_office','police_station','school','public_school',
        'college_university','public_library','historic_site','monument',
        'cemetery','bus_stop','religious_organization',
        'social_or_community_service'
      )
      and category not like '%place_of_worship%'
      and category not like '%government_%'
      and (
        length(regexp_replace(coalesce(phone,''),'[^0-9]','','g')) between 10 and 13
        or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        or website ~* '^https?://'
        or length(btrim(coalesce(instagram,''))) > 0
      )
  )::bigint as useful_companies
  from public.overture_places
) x;
$$;
revoke all on function public.overture_phase9_v5_status() from public,anon,authenticated;
grant execute on function public.overture_phase9_v5_status() to service_role;
comment on function public.overture_phase9_v5_status() is
'STAGING ONLY: total and preliminarily useful companies plus exact database/table sizes; service_role only.';
