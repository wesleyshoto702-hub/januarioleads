BEGIN;
INSERT INTO auth.users(id) VALUES ('44444444-4444-4444-4444-444444444444');
INSERT INTO public.private_access(user_id) VALUES ('44444444-4444-4444-4444-444444444444');
SET LOCAL ROLE service_role;
DO $$ DECLARE allowed boolean; BEGIN
 FOR request IN 1..81 LOOP
  allowed := public.claim_api_request_for_user('44444444-4444-4444-4444-444444444444','presence_site');
  IF allowed IS DISTINCT FROM (request <= 80) THEN RAISE EXCEPTION 'Wrong presence_site limit at request %', request; END IF;
 END LOOP;
 IF public.claim_api_request_for_user('55555555-5555-5555-5555-555555555555','presence_site') THEN RAISE EXCEPTION 'Unauthorized account allowed'; END IF;
 IF public.claim_api_request_for_user('44444444-4444-4444-4444-444444444444','unknown') THEN RAISE EXCEPTION 'Unknown bucket allowed'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
 PERFORM public.claim_api_request_for_user('44444444-4444-4444-4444-444444444444','presence_site');
 RAISE EXCEPTION 'Client invoked service-only RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
SELECT 'Rate-limit checks passed' AS result;
