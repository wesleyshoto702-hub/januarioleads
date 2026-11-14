-- STAGING ONLY: server-side quota measurement, available only with service-role key.
-- Preserve free plan: 340 MiB for Overture, 100 MiB for other functions,
-- and ~36.8 MiB of remaining quota buffer under 500 MB decimal.
create or replace function public.overture_phase9_v5_status()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
select pg_catalog.jsonb_build_object(
  'total_companies', (select count(*) from public.overture_places),
  'overture_bytes',pg_catalog.pg_total_relation_size('public.overture_places'::regclass),
  'database_bytes',pg_catalog.pg_database_size(pg_catalog.current_database())
)
$$;
revoke all on function public.overture_phase9_v5_status() from public,anon,authenticated;
grant execute on function public.overture_phase9_v5_status() to service_role;
comment on function public.overture_phase9_v5_status() is
'STAGING ONLY: accurate per-table+database storage and national cap before importing. Does not expose data publicly.';
