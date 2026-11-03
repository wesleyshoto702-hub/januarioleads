create table if not exists public.open_now_niche_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_key text not null,
  city text not null,
  state text not null,
  segment text not null,
  family text not null,
  status text not null default 'not_checked',
  checked_at timestamptz,
  expires_at timestamptz,
  next_page_token text,
  page_count integer not null default 0,
  request_count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, location_key, segment),
  constraint open_now_niche_cache_status_check
    check (status in ('open_results','no_open_results','not_checked','checking','error'))
);

create index if not exists open_now_niche_cache_location_idx
  on public.open_now_niche_cache(user_id, location_key, checked_at desc);

alter table public.open_now_niche_cache enable row level security;

drop policy if exists "Users can read own open now cache"
  on public.open_now_niche_cache;

create policy "Users can read own open now cache"
  on public.open_now_niche_cache
  for select
  using (auth.uid() = user_id);
