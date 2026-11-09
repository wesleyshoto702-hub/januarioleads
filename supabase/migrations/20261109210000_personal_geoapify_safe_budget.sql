-- Personal Geoapify searches: hard server-side daily cap, no SaaS credits.
-- This table never stores provider responses or changes existing CRM records.
CREATE TABLE IF NOT EXISTS public.personal_maps_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  search_count integer NOT NULL DEFAULT 0 CHECK (search_count BETWEEN 0 AND 10),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.personal_maps_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_maps_daily_usage FROM PUBLIC, anon, authenticated;

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
  v_count integer;
BEGIN
  -- Personal use only; changing to a commercial SaaS requires fresh authorization.
  IF v_user IS NULL OR v_user <> v_owner THEN
    RETURN false;
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
