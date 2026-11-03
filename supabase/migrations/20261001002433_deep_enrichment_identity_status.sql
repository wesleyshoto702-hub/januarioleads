alter table public.business_enrichment_runs
  add column if not exists summary_indicators jsonb not null default '[]'::jsonb;

alter table public.business_enrichment_sources
  add column if not exists identity_status text,
  add column if not exists identity_reason text,
  add column if not exists rejection_reason text;

alter table public.business_enrichment_sources
  drop constraint if exists business_enrichment_sources_identity_status_check;

alter table public.business_enrichment_sources
  add constraint business_enrichment_sources_identity_status_check
  check (
    identity_status is null
    or identity_status in ('confirmed','probable','insufficient','mismatch')
  );
