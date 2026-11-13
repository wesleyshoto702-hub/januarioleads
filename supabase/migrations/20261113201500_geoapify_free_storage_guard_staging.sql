-- STAGING ONLY: read-only byte counter for safe Colab early stop.
create or replace function public.overture_geoapify_storage_mib()
returns numeric language sql security invoker set search_path='' as $$
 select round(pg_catalog.pg_database_size(current_database())::numeric/1048576,2);
$$;
revoke all on function public.overture_geoapify_storage_mib() from public,anon,authenticated;
grant execute on function public.overture_geoapify_storage_mib() to service_role;
