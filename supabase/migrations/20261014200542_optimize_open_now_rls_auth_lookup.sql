drop policy if exists "Users can read own open now cache"
  on public.open_now_niche_cache;

create policy "Users can read own open now cache"
  on public.open_now_niche_cache
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
