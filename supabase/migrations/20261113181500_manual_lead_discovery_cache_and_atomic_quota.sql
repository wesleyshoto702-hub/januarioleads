-- On-demand company name discovery and contact enrichment caches.
-- No jobs, triggers, or changes to Overture / Colab import tables.
create table if not exists public.lead_cnpj_name_searches (
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  query_signature text not null check (length(query_signature) between 4 and 280),
  candidate_data jsonb not null default '[]'::jsonb
    check (jsonb_typeof(candidate_data)='array' and jsonb_array_length(candidate_data)<=10),
  source_url text not null default 'https://www.datastone.com.br/consulta',
  checked_at timestamptz not null default now(),
  primary key(user_id,lead_id)
);
create table if not exists public.lead_official_site_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  website_url text not null,
  email text,
  phone text,
  checked_at timestamptz not null default now(),
  primary key(user_id,lead_id)
);
create table if not exists public.lead_company_request_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  used integer not null default 1 check(used between 1 and 12),
  primary key(user_id,period_start)
);

alter table public.lead_cnpj_name_searches enable row level security;
alter table public.lead_official_site_contacts enable row level security;
alter table public.lead_company_request_quota enable row level security;
revoke all on public.lead_cnpj_name_searches, public.lead_official_site_contacts, public.lead_company_request_quota from public, anon, authenticated;
grant select on public.lead_cnpj_name_searches, public.lead_official_site_contacts to authenticated;
grant select,insert,update,delete on public.lead_cnpj_name_searches,public.lead_official_site_contacts,public.lead_company_request_quota to service_role;

drop policy if exists "Owner reads assisted CNPJ name suggestions" on public.lead_cnpj_name_searches;
create policy "Owner reads assisted CNPJ name suggestions"
 on public.lead_cnpj_name_searches for select to authenticated
 using (user_id=(select auth.uid()) and exists
 (select 1 from public.leads l where l.id=lead_id and l.user_id=(select auth.uid())));
drop policy if exists "Owner reads official site hints" on public.lead_official_site_contacts;
create policy "Owner reads official site hints"
 on public.lead_official_site_contacts for select to authenticated
 using (user_id=(select auth.uid()) and exists
 (select 1 from public.leads l where l.id=lead_id and l.user_id=(select auth.uid())));

-- Concurrency-safe quota: each provider request consumes a token *before*
-- dispatch, even on 404, timeout or upstream 429. All 3 modes share it.
-- Only service_role may call; exposed clients cannot impersonate a user.
create or replace function public.claim_lead_company_request(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_used integer;
begin
  if p_user_id is null then return false; end if;
  insert into public.lead_company_request_quota(user_id,period_start,used)
  values (p_user_id,date_trunc('hour',now()),1)
  on conflict(user_id,period_start) do update
    set used=public.lead_company_request_quota.used+1
    where public.lead_company_request_quota.used < 12
  returning used into v_used;
  return v_used is not null;
end;
$$;
revoke all on function public.claim_lead_company_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_lead_company_request(uuid) to service_role;

comment on table public.lead_cnpj_name_searches is 'One ten-result name-search cache per user lead, 24h TTL enforced by Edge Function; not a national company database.';
comment on table public.lead_official_site_contacts is 'One optional business website contact hint per lead; human review required.';
comment on table public.lead_company_request_quota is 'Atomic hourly per-account provider request budget: counts failed requests too; never touched by Overture.';
