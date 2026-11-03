-- Business Deep Enrichment: normalized audit trail + compact verified snapshot.
alter table public.leads
  add column if not exists verified_content jsonb not null default '{}'::jsonb,
  add column if not exists verified_images jsonb not null default '[]'::jsonb,
  add column if not exists confirmed_channels jsonb not null default '{}'::jsonb,
  add column if not exists deep_enrichment_status text,
  add column if not exists deep_enrichment_quality text,
  add column if not exists deep_enrichment_checked_at timestamptz;

create table if not exists public.business_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  business_key text not null,
  place_id text,
  identity_signature text not null,
  identity jsonb not null default '{}'::jsonb,
  niche_key text not null,
  niche_family text not null,
  status text not null default 'researching'
    check (status in ('not_started','researching','completed','needs_review','failed')),
  quality text
    check (quality is null or quality in ('low','medium','high')),
  completeness numeric(5,4),
  verified_content jsonb not null default '{}'::jsonb,
  verified_images jsonb not null default '[]'::jsonb,
  confirmed_channels jsonb not null default '{}'::jsonb,
  identity_updates jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_summary text,
  force_refresh boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_enrichment_sources (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.business_enrichment_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  source_type text not null,
  source_url text not null,
  source_domain text not null,
  page_title text,
  extraction_method text not null,
  identity_score integer not null default 0 check (identity_score between 0 and 100),
  confidence text not null check (confidence in ('high','medium','low')),
  source_updated_at timestamptz,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.business_enrichment_facts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.business_enrichment_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  business_key text not null,
  source_id uuid references public.business_enrichment_sources(id) on delete set null,
  fact_type text not null,
  label text not null,
  value jsonb not null default '{}'::jsonb,
  normalized_value text not null,
  fact_signature text not null,
  confidence text not null check (confidence in ('high','medium','low')),
  resolution text not null
    check (resolution in ('auto_verified','needs_review','low_confidence','manual_verified','rejected')),
  evidence_summary text,
  discovered_at timestamptz not null default now(),
  checked_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists business_enrichment_runs_user_business_idx
  on public.business_enrichment_runs(user_id, business_key, created_at desc);
create index if not exists business_enrichment_runs_cache_idx
  on public.business_enrichment_runs(user_id, identity_signature, expires_at desc)
  where status in ('completed','needs_review');
create index if not exists business_enrichment_sources_run_idx
  on public.business_enrichment_sources(run_id);
create index if not exists business_enrichment_facts_run_idx
  on public.business_enrichment_facts(run_id, resolution, fact_type);
create index if not exists business_enrichment_facts_rejections_idx
  on public.business_enrichment_facts(user_id, business_key, fact_signature)
  where resolution = 'rejected';

alter table public.business_enrichment_runs enable row level security;
alter table public.business_enrichment_sources enable row level security;
alter table public.business_enrichment_facts enable row level security;

drop policy if exists business_enrichment_runs_select_own on public.business_enrichment_runs;
create policy business_enrichment_runs_select_own
on public.business_enrichment_runs for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.private_access pa
    where pa.user_id = (select auth.uid())
  )
  and (
    lead_id is null
    or exists (
      select 1 from public.leads l
      where l.id = business_enrichment_runs.lead_id
        and l.user_id = (select auth.uid())
    )
  )
);

drop policy if exists business_enrichment_sources_select_own on public.business_enrichment_sources;
create policy business_enrichment_sources_select_own
on public.business_enrichment_sources for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.private_access pa
    where pa.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.business_enrichment_runs r
    where r.id = business_enrichment_sources.run_id
      and r.user_id = (select auth.uid())
  )
);

drop policy if exists business_enrichment_facts_select_own on public.business_enrichment_facts;
create policy business_enrichment_facts_select_own
on public.business_enrichment_facts for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.private_access pa
    where pa.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.business_enrichment_runs r
    where r.id = business_enrichment_facts.run_id
      and r.user_id = (select auth.uid())
  )
);
