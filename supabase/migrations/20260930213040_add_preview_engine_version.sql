alter table public.site_previews
  add column if not exists preview_engine_version text;
