-- Manual-only company identity and contact suggestions.
-- Separate from Overture import tables and from the user's CRM lead row.
-- Do not schedule crawlers, bulk jobs or WhatsApp checks.
create table if not exists public.lead_company_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  cnpj text not null check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
  corporate_name text not null,
  trade_name text,
  registration_status text,
  status_date date,
  city text,
  state text,
  contact_phone text,
  contact_phone_alt text,
  contact_email text,
  identity_review_required boolean not null default true,
  source text not null default 'brasilapi' check (source = 'brasilapi'),
  source_url text not null,
  checked_at timestamptz not null default now(),
  -- Reserved for a future compliant provider with consent/delivery proof.
  -- Never claim that a number is verified just because it has 10-11 digits.
  whatsapp_status text not null default 'not_verified'
    check (whatsapp_status in ('not_verified','confirmed_by_provider','not_confirmed_by_provider')),
  whatsapp_provider text,
  whatsapp_checked_at timestamptz,
  primary key (user_id, lead_id),
  constraint lead_company_checks_whatsapp_evidence check (
    (whatsapp_status = 'not_verified' and whatsapp_provider is null and whatsapp_checked_at is null)
    or
    (whatsapp_status <> 'not_verified' and whatsapp_provider is not null and whatsapp_checked_at is not null)
  )
);
create index if not exists lead_company_checks_user_checked_idx
  on public.lead_company_checks(user_id, checked_at desc);
alter table public.lead_company_checks enable row level security;

-- Only authenticated lead owners can read; writes are service-only through
-- the authenticated, on-demand Edge Function.
revoke all on public.lead_company_checks from public, anon, authenticated;
grant select on public.lead_company_checks to authenticated;
drop policy if exists "Lead owner can see manual company checks"
  on public.lead_company_checks;
create policy "Lead owner can see manual company checks"
  on public.lead_company_checks for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.leads l
      where l.id = lead_id and l.user_id = (select auth.uid())
    )
  );
