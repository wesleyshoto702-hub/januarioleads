-- Saved lead favorites use the EXISTING owner-scoped CRM table and RLS.
-- No new table, role, policy or paid API is required.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.is_favorite IS
  'User-selected favorite in Meus Leads; true displays this lead in the Favoritos filter.';
