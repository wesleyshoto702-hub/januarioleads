-- Temporarily pause the PERSONAL (owner-only) 10-searches/day cap without
-- deleting the original enforcement code or resetting historical usage.
--
-- Re-enable (only upon owner request):
-- UPDATE public.personal_maps_daily_limit_control
-- SET enabled=true,updated_at=now() WHERE id=1;
--
-- Pause again (only upon owner request):
-- UPDATE public.personal_maps_daily_limit_control
-- SET enabled=false,updated_at=now() WHERE id=1;
--
-- The original Google Cloud / Geoapify billing and provider quotas remain
-- independently effective; this flag does NOT remove any of those controls.
CREATE TABLE IF NOT EXISTS public.personal_maps_daily_limit_control (
  id smallint NOT NULL DEFAULT 1 PRIMARY KEY CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_maps_daily_limit_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_maps_daily_limit_control FROM PUBLIC, anon, authenticated;
-- Do not overwrite future reactivation on a repeated migration.
INSERT INTO public.personal_maps_daily_limit_control (id,enabled)
VALUES (1,false) ON CONFLICT (id) DO NOTHING;

-- Preserve the original policy exactly when 'enabled' is true.
-- When false, the owner-only JWT check remains mandatory but no daily
-- usage record is touched (including an already exhausted day's count).
CREATE OR REPLACE FUNCTION public.claim_personal_geoapify_search()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner constant uuid := '531d0690-bdb5-4549-b07a-76da37e2ff96';
  v_user uuid := auth.uid();
  v_date date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_enabled boolean := true;
  v_count integer;
BEGIN
  -- Personal use only; changing to a commercial SaaS requires fresh authorization.
  IF v_user IS NULL OR v_user <> v_owner THEN
    RETURN false;
  END IF;

  SELECT enabled INTO v_enabled
  FROM public.personal_maps_daily_limit_control
  WHERE id = 1;
  IF v_enabled IS FALSE THEN
    RETURN true;
  END IF;

  INSERT INTO public.personal_maps_daily_usage (user_id, usage_date, search_count)
    VALUES (v_user, v_date, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET search_count = public.personal_maps_daily_usage.search_count + 1
      WHERE public.personal_maps_daily_usage.search_count < 10
    RETURNING search_count INTO v_count;
  RETURN v_count IS NOT NULL;
END
$$;

REVOKE ALL ON FUNCTION public.claim_personal_geoapify_search() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_personal_geoapify_search() TO authenticated;
