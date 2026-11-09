-- Safe, additive CRM extension. Does not rewrite existing leads or activities.
-- Counts each user's first "Mandar mensagem" click once per saved lead.
-- Deleting a lead automatically removes its prospecting touch.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lead_prospecting_touches (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  first_clicked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_prospecting_touches_pkey PRIMARY KEY (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS lead_prospecting_touches_lead_id_idx
  ON public.lead_prospecting_touches (lead_id);

ALTER TABLE public.lead_prospecting_touches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_prospecting_touches_select_own ON public.lead_prospecting_touches;
CREATE POLICY lead_prospecting_touches_select_own
  ON public.lead_prospecting_touches
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS lead_prospecting_touches_insert_own ON public.lead_prospecting_touches;
CREATE POLICY lead_prospecting_touches_insert_own
  ON public.lead_prospecting_touches
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.leads AS l
      WHERE l.id = lead_id AND l.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON public.lead_prospecting_touches FROM anon;
GRANT SELECT, INSERT ON public.lead_prospecting_touches TO authenticated;

COMMIT;
