alter table public.business_enrichment_runs
  add column if not exists engine_version text;

alter table public.business_enrichment_sources
  add column if not exists source_kind text,
  add column if not exists fetch_method text,
  add column if not exists extraction_status text,
  add column if not exists browserless_decision text,
  add column if not exists browserless_reason text,
  add column if not exists linked_from text,
  add column if not exists facts_found integer not null default 0;

alter table public.business_enrichment_sources
  drop constraint if exists business_enrichment_sources_extraction_status_check;

alter table public.business_enrichment_sources
  add constraint business_enrichment_sources_extraction_status_check
  check (
    extraction_status is null
    or extraction_status in ('successful','partial','inconclusive','blocked','failed')
  );
