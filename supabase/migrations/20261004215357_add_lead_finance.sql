alter table public.leads
  add column if not exists project_value numeric(12,2),
  add column if not exists financial_notes text;

alter table public.leads
  drop constraint if exists leads_project_value_nonnegative;

alter table public.leads
  add constraint leads_project_value_nonnegative
  check (project_value is null or project_value >= 0);

create table if not exists public.lead_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  payment_method text not null,
  payment_method_other text,
  notes text,
  created_at timestamptz not null default now(),
  constraint lead_payments_amount_positive check (amount > 0),
  constraint lead_payments_method_check
    check (payment_method in ('pix','cash','card','transfer','other')),
  constraint lead_payments_other_length_check
    check (payment_method_other is null or char_length(payment_method_other) <= 80),
  constraint lead_payments_notes_length_check
    check (notes is null or char_length(notes) <= 500)
);

create index if not exists lead_payments_user_date_idx
  on public.lead_payments(user_id, payment_date desc);

create index if not exists lead_payments_lead_date_idx
  on public.lead_payments(lead_id, payment_date desc, created_at desc);

alter table public.lead_payments enable row level security;

revoke all on table public.lead_payments from anon;
revoke all on table public.lead_payments from authenticated;
grant select, insert on table public.lead_payments to authenticated;
grant select, insert, update, delete on table public.lead_payments to service_role;

drop policy if exists "Users can read own lead payments"
  on public.lead_payments;
create policy "Users can read own lead payments"
  on public.lead_payments
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add own lead payments"
  on public.lead_payments;
create policy "Users can add own lead payments"
  on public.lead_payments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.leads
      where leads.id = lead_payments.lead_id
        and leads.user_id = (select auth.uid())
    )
  );
