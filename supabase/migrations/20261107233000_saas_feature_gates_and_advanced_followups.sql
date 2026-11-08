-- SaaS phase 2/3: production-ready feature checks, finance RLS and Advanced internal automation.
-- Applied and verified only in isolated Supabase Staging. Never merge into prod before E2E.
-- No checkout, no billing, no email/WhatsApp automation.
CREATE OR REPLACE FUNCTION public.saas_my_feature_enabled(p_feature_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_plan_features f
    JOIN public.saas_plans p ON p.code = f.plan_code AND p.active
    WHERE f.feature_key = p_feature_key
      AND f.enabled
      AND f.plan_code = COALESCE((
        SELECT s.plan_code FROM public.saas_subscriptions s
        WHERE s.user_id = (SELECT auth.uid()) AND s.status = 'active'
          AND s.period_end > now()
      ), 'free')
      AND (SELECT auth.uid()) IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.saas_my_feature_enabled(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saas_my_feature_enabled(text) TO authenticated, service_role;

-- Acesso financeiro não depende do botão escondido no frontend.
DROP POLICY IF EXISTS "Users can read own lead payments" ON public.lead_payments;
DROP POLICY IF EXISTS "Users can add own lead payments" ON public.lead_payments;

CREATE POLICY saas_finance_read_own ON public.lead_payments
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id AND (SELECT public.saas_my_feature_enabled('finance')));

CREATE POLICY saas_finance_insert_own ON public.lead_payments
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (SELECT public.saas_my_feature_enabled('finance'))
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_id AND l.user_id = (SELECT auth.uid())
  )
);

-- Finance is also stored in leads.project_value and leads.financial_notes.
-- Block client writes to those fields for Free without blocking ordinary CRM updates.
CREATE FUNCTION public.saas_protect_finance_columns()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' AND
      (NEW.project_value IS NOT NULL OR nullif(btrim(coalesce(NEW.financial_notes, '')), '') IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND
      (NEW.project_value IS DISTINCT FROM OLD.project_value
       OR NEW.financial_notes IS DISTINCT FROM OLD.financial_notes)) THEN
    IF NOT public.saas_my_feature_enabled('finance') THEN
      RAISE EXCEPTION 'Recurso financeiro indisponível no seu plano.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.saas_protect_finance_columns() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saas_protect_finance_columns() TO service_role;
CREATE TRIGGER saas_finance_guard
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.saas_protect_finance_columns();

-- Server-side automation parameters: opt-in, persisted and RLS-scoped to Advanced.
CREATE TABLE public.saas_automation_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  follow_up_enabled boolean NOT NULL DEFAULT false,
  follow_up_after_days smallint NOT NULL DEFAULT 3
    CHECK (follow_up_after_days BETWEEN 1 AND 14),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_automation_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_automation_settings FROM public, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.saas_automation_settings TO authenticated;
GRANT ALL ON public.saas_automation_settings TO service_role;

CREATE POLICY saas_automation_own_read ON public.saas_automation_settings
FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY saas_automation_advanced_insert ON public.saas_automation_settings
FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id
  AND (SELECT public.saas_my_feature_enabled('internal_automations')));
CREATE POLICY saas_automation_advanced_update ON public.saas_automation_settings
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id
  AND (SELECT public.saas_my_feature_enabled('internal_automations')))
WITH CHECK ((SELECT auth.uid()) = user_id
  AND (SELECT public.saas_my_feature_enabled('internal_automations')));
CREATE POLICY saas_automation_advanced_delete ON public.saas_automation_settings
FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id
  AND (SELECT public.saas_my_feature_enabled('internal_automations')));

-- Creating or moving a lead to "waiting" can create a follow-up task automatically.
-- This is INTERNAL ONLY: no outgoing WhatsApp, push notification, e-mail or scheduler.
-- Never overwrite an explicit next action or another user's lead.
CREATE FUNCTION public.saas_schedule_waiting_followup()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.status <> 'waiting' OR
     (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) OR
     NEW.next_action_type IS NOT NULL OR NEW.next_action_date IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NULL OR NEW.user_id IS DISTINCT FROM (SELECT auth.uid())
    OR NOT public.saas_my_feature_enabled('internal_automations') THEN
    RETURN NEW;
  END IF;

  SELECT s.follow_up_after_days INTO v_days
  FROM public.saas_automation_settings s
  WHERE s.user_id = NEW.user_id AND s.follow_up_enabled = true;

  IF v_days IS NOT NULL THEN
    NEW.next_action_type := 'follow_up';
    NEW.next_action_date := (now() AT TIME ZONE 'America/Sao_Paulo')::date + v_days;
    NEW.next_action_notes := 'Follow-up agendado pela automação interna do Advanced.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.saas_schedule_waiting_followup() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saas_schedule_waiting_followup() TO service_role;
CREATE TRIGGER saas_auto_waiting_followup
BEFORE INSERT OR UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.saas_schedule_waiting_followup();

CREATE INDEX saas_automation_settings_enabled_idx
ON public.saas_automation_settings(user_id) WHERE follow_up_enabled = true;
