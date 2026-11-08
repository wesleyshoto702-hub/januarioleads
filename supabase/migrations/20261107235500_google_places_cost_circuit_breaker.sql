-- Staging-first: per-call project + per-user consumption caps for Google Places.
-- A defense-in-depth circuit breaker, NOT a substitute for Google Cloud quotas.
-- Neither table is readable/writable by anon or authenticated; no user data copied.
CREATE TABLE IF NOT EXISTS public.saas_google_api_limits (
  operation text PRIMARY KEY CHECK (operation IN (
    'text_search_pro','text_search_enterprise','place_details_enterprise'
  )),
  daily_project integer NOT NULL CHECK (daily_project BETWEEN 0 AND 1000000),
  monthly_project integer NOT NULL CHECK (monthly_project BETWEEN 0 AND 30000000),
  daily_user integer NOT NULL CHECK (daily_user BETWEEN 0 AND 100000),
  enabled boolean NOT NULL DEFAULT true
);

INSERT INTO public.saas_google_api_limits(operation, daily_project, monthly_project, daily_user)
VALUES
  ('text_search_pro',150,3500,12),
  ('text_search_enterprise',40,850,5),
  ('place_details_enterprise',40,650,6)
ON CONFLICT (operation) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.saas_google_api_usage (
  operation text NOT NULL REFERENCES public.saas_google_api_limits(operation),
  scope text NOT NULL CHECK (length(scope) <= 120),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operation,scope)
);

ALTER TABLE public.saas_google_api_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_google_api_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_google_api_limits,public.saas_google_api_usage
  FROM public,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.saas_google_api_limits,public.saas_google_api_usage
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_saas_google_api_budget(
  p_user_id uuid, p_operation text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_config public.saas_google_api_limits%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_month date := date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day_scope text;
  v_month_scope text;
  v_user_scope text;
  v_day_count integer;
  v_month_count integer;
  v_user_count integer;
BEGIN
  IF p_user_id IS NULL OR p_operation IS NULL OR
     NOT EXISTS (SELECT 1 FROM public.private_access WHERE user_id = p_user_id) THEN
    RETURN false;
  END IF;
  SELECT * INTO v_config FROM public.saas_google_api_limits
  WHERE operation = p_operation AND enabled = true;
  IF NOT FOUND THEN RETURN false; END IF;

  -- One serialized counter transaction per operation avoids parallel bypass.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('januario-google-api'),
    pg_catalog.hashtext(p_operation)
  );

  v_day_scope := 'global-day:' || v_today::text;
  v_month_scope := 'global-month:' || v_month::text;
  v_user_scope := 'user:' || p_user_id::text || ':day:' || v_today::text;

  SELECT coalesce((SELECT request_count FROM public.saas_google_api_usage
    WHERE operation = p_operation AND scope = v_day_scope),0) INTO v_day_count;
  SELECT coalesce((SELECT request_count FROM public.saas_google_api_usage
    WHERE operation = p_operation AND scope = v_month_scope),0) INTO v_month_count;
  SELECT coalesce((SELECT request_count FROM public.saas_google_api_usage
    WHERE operation = p_operation AND scope = v_user_scope),0) INTO v_user_count;

  IF v_day_count >= v_config.daily_project OR
     v_month_count >= v_config.monthly_project OR
     v_user_count >= v_config.daily_user THEN
    RETURN false;
  END IF;

  INSERT INTO public.saas_google_api_usage(operation,scope,request_count)
  VALUES(p_operation,v_day_scope,1),(p_operation,v_month_scope,1),
    (p_operation,v_user_scope,1)
  ON CONFLICT (operation,scope) DO UPDATE SET
    request_count = public.saas_google_api_usage.request_count + 1,
    updated_at = now();
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_saas_google_api_budget(uuid,text)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_saas_google_api_budget(uuid,text) TO service_role;

COMMENT ON TABLE public.saas_google_api_limits IS
  'Backend guardrail, not official Google Cloud quotas or financial spend limits.';
