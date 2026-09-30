-- Expand the existing Instagram discovery flow without changing existing lead values.
alter table public.leads
  add column if not exists instagram_username text,
  add column if not exists instagram_candidates jsonb not null default '[]'::jsonb,
  add column if not exists instagram_rejected_urls text[] not null default '{}'::text[],
  add column if not exists instagram_search_signature text,
  add column if not exists instagram_needs_review boolean not null default false;

alter table public.leads
  drop constraint if exists leads_instagram_source_check;

alter table public.leads
  add constraint leads_instagram_source_check
  check (
    instagram_source is null
    or instagram_source = any (array[
      'google_places'::text,
      'official_website'::text,
      'web_search'::text,
      'manual_confirmation'::text,
      'existing_data'::text
    ])
  );

alter table public.leads
  drop constraint if exists leads_instagram_candidates_array_check;

alter table public.leads
  add constraint leads_instagram_candidates_array_check
  check (jsonb_typeof(instagram_candidates) = 'array');
