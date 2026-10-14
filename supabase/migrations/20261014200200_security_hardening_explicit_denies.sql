drop policy if exists "No direct client access to API rate limits"
  on public.api_request_rate_limit;
create policy "No direct client access to API rate limits"
  on public.api_request_rate_limit
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct client access to open now refresh guard"
  on public.open_now_refresh_guard;
create policy "No direct client access to open now refresh guard"
  on public.open_now_refresh_guard
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "No direct client access to sync config"
  on public.sync_internal_config;
create policy "No direct client access to sync config"
  on public.sync_internal_config
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on function public.set_leads_updated_at()
  from public, anon, authenticated;
grant execute on function public.set_leads_updated_at()
  to service_role;
