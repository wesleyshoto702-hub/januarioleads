-- Per-account API throttling (one atomic window per bucket).
-- Staging-first; production must not receive this without commercial approval.
-- Not a substitute for project-wide billable API budgets or Google Cloud quotas.
CREATE OR REPLACE FUNCTION public.claim_api_request_for_user(p_user_id uuid,p_bucket text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_limit integer;
  v_window_seconds integer := 900; -- 15 minutes
  v_granted integer;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.private_access WHERE user_id=p_user_id
  ) THEN RETURN false; END IF;
  v_limit := CASE p_bucket
    WHEN 'places_search' THEN 15
    WHEN 'lead_enrichment' THEN 8
    WHEN 'presence_discovery' THEN 6
    WHEN 'presence_site' THEN 24
    WHEN 'deep_enrichment' THEN 4
    ELSE NULL
  END;
  IF v_limit IS NULL THEN RETURN false; END IF;

  INSERT INTO public.api_request_rate_limit(
    user_id,bucket,window_started_at,request_count,updated_at
  ) VALUES(p_user_id,p_bucket,now(),1,now())
  ON CONFLICT (user_id,bucket) DO UPDATE SET
    window_started_at = CASE WHEN public.api_request_rate_limit.window_started_at <
      now()-make_interval(secs=>v_window_seconds) THEN now()
      ELSE public.api_request_rate_limit.window_started_at END,
    request_count = CASE WHEN public.api_request_rate_limit.window_started_at <
      now()-make_interval(secs=>v_window_seconds) THEN 1
      ELSE public.api_request_rate_limit.request_count+1 END,
    updated_at=now()
  WHERE public.api_request_rate_limit.window_started_at <
    now()-make_interval(secs=>v_window_seconds)
    OR public.api_request_rate_limit.request_count < v_limit
  RETURNING request_count INTO v_granted;

  -- Rows already at the cap are not modified. Avoid incrementing to infinity.
  RETURN v_granted IS NOT NULL AND v_granted <= v_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_api_request_for_user(uuid,text)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_api_request_for_user(uuid,text) TO service_role;
