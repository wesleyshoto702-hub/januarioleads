-- Production migration history: 20261111003505 / commercial_workspace_documents_rls.
-- Staging received the same schema as 20261111003400.
-- This migration is repeat-safe because the existing repo and staging histories
-- are not yet fully reconciled. No existing CRM or payment table is changed.
create table if not exists public.commercial_workspace_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null,
  content jsonb not null default '[]'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint commercial_workspace_documents_pk primary key (user_id,document_key),
  constraint commercial_workspace_documents_allowed_keys check (
    document_key in (
      'proposals','campaigns','sequences','enrollments',
      'agenda','objections','projects','goals','digital-reports'
    )
  ),
  constraint commercial_workspace_documents_content_array check (
    jsonb_typeof(content)='array'
    and jsonb_array_length(content)<=500
    and octet_length(content::text)<=500000
  ),
  constraint commercial_workspace_documents_revision_check check (revision>=1)
);

comment on table public.commercial_workspace_documents is
  'Isolated per-account commercial workspace snapshots. Never stores private provider credentials.';

alter table public.commercial_workspace_documents enable row level security;
revoke all on table public.commercial_workspace_documents from public,anon,authenticated;
grant select,insert,update on table public.commercial_workspace_documents to authenticated;

do $policies$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='commercial_workspace_documents'
    and policyname='Owners read commercial workspace documents'
  ) then
    create policy "Owners read commercial workspace documents"
      on public.commercial_workspace_documents for select to authenticated
      using (user_id=(select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='commercial_workspace_documents'
    and policyname='Owners create commercial workspace documents'
  ) then
    create policy "Owners create commercial workspace documents"
      on public.commercial_workspace_documents for insert to authenticated
      with check (user_id=(select auth.uid()));
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public'
    and tablename='commercial_workspace_documents'
    and policyname='Owners update commercial workspace documents'
  ) then
    create policy "Owners update commercial workspace documents"
      on public.commercial_workspace_documents for update to authenticated
      using (user_id=(select auth.uid()))
      with check (user_id=(select auth.uid()));
  end if;
end
$policies$;
