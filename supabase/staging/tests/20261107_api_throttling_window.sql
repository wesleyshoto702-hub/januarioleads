-- Staging-only atomic rate limiting test. No Google requests.
BEGIN;
DO $$
DECLARE u uuid; i integer; n integer;
BEGIN
  SELECT user_id INTO u FROM public.private_access LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'Missing staging test user'; END IF;
  DELETE FROM public.api_request_rate_limit WHERE user_id=u AND bucket='places_search';
  FOR i IN 1..15 LOOP
    IF NOT public.claim_api_request_for_user(u,'places_search') THEN
      RAISE EXCEPTION 'Allowed request % was denied',i;
    END IF;
  END LOOP;
  IF public.claim_api_request_for_user(u,'places_search') THEN
    RAISE EXCEPTION '16th request bypassed 15/15min cap';
  END IF;
  IF public.claim_api_request_for_user(u,'places_search') THEN
    RAISE EXCEPTION 'Repeated throttled request passed';
  END IF;
  SELECT request_count INTO n FROM public.api_request_rate_limit
    WHERE user_id=u AND bucket='places_search';
  IF n <> 15 THEN RAISE EXCEPTION 'Denied requests modified counter: %',n; END IF;
  IF public.claim_api_request_for_user(u,'not-real') THEN
    RAISE EXCEPTION 'Unknown bucket allowed';
  END IF;
  IF has_function_privilege('authenticated','public.claim_api_request_for_user(uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.claim_api_request_for_user(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC unexpectedly public';
  END IF;
  RAISE NOTICE 'PASS: 15/15min cap, no overcount on 429, unknown bucket denied, service-only ACL';
END $$;
ROLLBACK;