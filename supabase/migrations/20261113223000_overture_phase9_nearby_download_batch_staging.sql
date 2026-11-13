-- Staging-only read-only municipal centers for grouping nearby Overture downloads.
-- View runs as invoker; only the server-side service_role can select it.
create or replace view public.overture_phase9_city_centers
with (security_invoker = true) as
select state, city, city_key,
       count(*)::integer as imported_rows,
       avg(latitude)::double precision as center_lat,
       avg(longitude)::double precision as center_lon
from public.overture_places
where state is not null and city_key is not null
group by state, city, city_key;
revoke all on public.overture_phase9_city_centers from public, anon, authenticated;
grant select on public.overture_phase9_city_centers to service_role;
comment on view public.overture_phase9_city_centers is
'STAGING ONLY. Cluster eligible nearby towns into small Overture download batches. No production/public access.';
