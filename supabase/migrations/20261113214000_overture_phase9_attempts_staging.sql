-- Januário Leads / STAGING ONLY. Phase 9 checkpoint table, never exposed to client roles.
create table if not exists public.overture_phase9_attempts (
    state varchar(2) not null,
    city_key text not null,
    city text not null,
    result text not null check (result in ('gained','no_more','error','partial')),
    before_count integer not null check (before_count between 0 and 100),
    after_count integer not null check (after_count between 0 and 100),
    added_count integer not null check (added_count between 0 and 100),
    attempted_at timestamptz not null default now(),
    retry_after timestamptz not null default now(),
    primary key (state, city_key)
);
alter table public.overture_phase9_attempts enable row level security;
revoke all on public.overture_phase9_attempts from public, anon, authenticated;
grant select, insert, update on public.overture_phase9_attempts to service_role;
comment on table public.overture_phase9_attempts is
'Staging-only manual Overture Phase 9 per-municipality checkpoint; keeps original imported places intact and prevents redundant re-downloads.';
