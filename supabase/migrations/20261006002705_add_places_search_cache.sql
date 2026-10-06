create table public.places_search_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_key text not null,
  city text not null,
  state text not null,
  segment text not null,
  checked_at timestamptz not null default now(),
  next_page_token text null,
  page_count integer not null default 1,
  results jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, location_key, segment),
  constraint places_search_cache_location_key_length
    check (char_length(location_key) between 3 and 240),
  constraint places_search_cache_city_length
    check (char_length(city) between 2 and 120),
  constraint places_search_cache_state_length
    check (char_length(state) between 2 and 40),
  constraint places_search_cache_segment_length
    check (char_length(segment) between 2 and 160),
  constraint places_search_cache_page_count_positive
    check (page_count >= 1),
  constraint places_search_cache_results_array
    check (jsonb_typeof(results) = 'array')
);

create index places_search_cache_checked_idx
  on public.places_search_cache (user_id, checked_at desc);

create index places_search_cache_location_idx
  on public.places_search_cache (user_id, location_key);

alter table public.places_search_cache enable row level security;

revoke all on table public.places_search_cache from anon;
grant select, insert, update on table public.places_search_cache to authenticated;
grant select, insert, update on table public.places_search_cache to service_role;

create policy "Users can read own places search cache"
  on public.places_search_cache
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own places search cache"
  on public.places_search_cache
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own places search cache"
  on public.places_search_cache
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
