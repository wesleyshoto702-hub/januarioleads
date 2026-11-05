-- RLS HARDENING CONTRACT TEST (DISPOSABLE POSTGRES ONLY)
--
-- Runs AFTER docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt.
-- Two fictional tenants plus one never-authorized tenant.
-- Uses auth.uid() fixture only; does not verify real JWT, GoTrue or PostgREST.
-- All test rows and authorization changes are rolled back.
BEGIN;

INSERT INTO auth.users(id) VALUES
  ('88888888-8888-8888-8888-888888888888'),
  ('99999999-9999-9999-9999-999999999999'),
  ('55555555-5555-5555-5555-555555555555');

INSERT INTO public.private_access(user_id) VALUES
  ('88888888-8888-8888-8888-888888888888'),
  ('99999999-9999-9999-9999-999999999999');

-- Authorized account A creates records through normal client privileges.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','88888888-8888-8888-8888-888888888888',true);
INSERT INTO public.leads(id,user_id,company,segment,first_contact)
VALUES ('88888888-8888-8888-8888-888888888889',auth.uid(),'Empresa fictícia A','Teste',CURRENT_DATE);
INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method)
VALUES ('88888888-8888-8888-8888-888888888889',auth.uid(),10,'pix');
INSERT INTO public.places_search_cache(user_id,location_key,city,state,segment,results)
VALUES (auth.uid(),'fake-a|mg','Lavras','MG','Restaurante','[]'::jsonb);
RESET ROLE;

-- Independent authorized account B owns its own records.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
INSERT INTO public.leads(id,user_id,company,segment,first_contact)
VALUES ('99999999-9999-9999-9999-999999999998',auth.uid(),'Empresa fictícia B','Teste',CURRENT_DATE);
INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method)
VALUES ('99999999-9999-9999-9999-999999999998',auth.uid(),20,'pix');
INSERT INTO public.places_search_cache(user_id,location_key,city,state,segment,results)
VALUES (auth.uid(),'fake-b|mg','Lavras','MG','Academia','[]'::jsonb);
RESET ROLE;

-- This cache has service-only INSERT permissions.
INSERT INTO public.open_now_niche_cache(user_id,location_key,city,state,segment,family)
VALUES
  ('88888888-8888-8888-8888-888888888888','fake-a|mg','Lavras','MG','Restaurante','Alimentação'),
  ('99999999-9999-9999-9999-999999999999','fake-b|mg','Lavras','MG','Academia','Saúde');

-- Both authorized accounts retain visibility and functionality.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','88888888-8888-8888-8888-888888888888',true);
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 1
     OR (SELECT SUM(amount) FROM public.lead_payments) <> 10 THEN
    RAISE EXCEPTION 'Account A payment isolation or authorization failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.places_search_cache) <> 1
     OR NOT EXISTS(SELECT 1 FROM public.places_search_cache WHERE location_key='fake-a|mg') THEN
    RAISE EXCEPTION 'Account A places cache isolation failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 1
     OR NOT EXISTS(SELECT 1 FROM public.open_now_niche_cache WHERE location_key='fake-a|mg') THEN
    RAISE EXCEPTION 'Account A open-now cache isolation failed';
  END IF;
END $$;
UPDATE public.places_search_cache SET page_count=2 WHERE location_key='fake-a|mg';
DO $$ BEGIN
  IF (SELECT page_count FROM public.places_search_cache WHERE location_key='fake-a|mg') <> 2 THEN
    RAISE EXCEPTION 'Account A cannot update own cached search';
  END IF;
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 1
     OR (SELECT SUM(amount) FROM public.lead_payments) <> 20 THEN
    RAISE EXCEPTION 'Account B payment isolation or authorization failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.places_search_cache) <> 1
     OR NOT EXISTS(SELECT 1 FROM public.places_search_cache WHERE location_key='fake-b|mg') THEN
    RAISE EXCEPTION 'Account B places cache isolation failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 1
     OR NOT EXISTS(SELECT 1 FROM public.open_now_niche_cache WHERE location_key='fake-b|mg') THEN
    RAISE EXCEPTION 'Account B open-now cache isolation failed';
  END IF;
END $$;
-- Cross-tenant UPDATE must modify no rows.
UPDATE public.places_search_cache SET page_count=99 WHERE location_key='fake-a|mg';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.places_search_cache WHERE location_key='fake-a|mg') THEN
    RAISE EXCEPTION 'Account B can see account A cached search';
  END IF;
END $$;
-- Cross-tenant INSERT must be rejected by ownership and allowlist checks.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.places_search_cache(
      user_id,location_key,city,state,segment,results
    ) VALUES (
      '88888888-8888-8888-8888-888888888888',
      'fake-cross|mg','Lavras','MG','Barbearia','[]'::jsonb
    );
    RAISE EXCEPTION 'Account B inserted as account A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Revocation changes only the allowlist, not the account or its historical rows.
DELETE FROM public.private_access
WHERE user_id='88888888-8888-8888-8888-888888888888';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','88888888-8888-8888-8888-888888888888',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.lead_payments) THEN
    RAISE EXCEPTION 'Revoked account can read own payments';
  END IF;
  IF EXISTS(SELECT 1 FROM public.places_search_cache) THEN
    RAISE EXCEPTION 'Revoked account can read own places cache';
  END IF;
  IF EXISTS(SELECT 1 FROM public.open_now_niche_cache) THEN
    RAISE EXCEPTION 'Revoked account can read own open-now cache';
  END IF;
  IF EXISTS(SELECT 1 FROM public.leads) THEN
    RAISE EXCEPTION 'Revoked account can read own leads';
  END IF;
END $$;

UPDATE public.places_search_cache SET page_count=3 WHERE location_key='fake-a|mg';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.places_search_cache WHERE location_key='fake-a|mg') THEN
    RAISE EXCEPTION 'Revoked account updated own places cache';
  END IF;
END $$;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.places_search_cache(
      user_id,location_key,city,state,segment,results
    ) VALUES (
      auth.uid(),'fake-revoked|mg','Lavras','MG','Academia','[]'::jsonb
    );
    RAISE EXCEPTION 'Revoked account inserted cached search';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Account B must remain authorized even while A is revoked.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999',true);
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 1
     OR (SELECT COUNT(*) FROM public.places_search_cache) <> 1
     OR (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 1 THEN
    RAISE EXCEPTION 'Revoking A broke access for authorized B';
  END IF;
END $$;
UPDATE public.places_search_cache SET page_count=4 WHERE location_key='fake-b|mg';
RESET ROLE;

-- A never-authorized account sees no records from either tenant and
-- cannot fabricate entries.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','55555555-5555-5555-5555-555555555555',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.lead_payments)
     OR EXISTS(SELECT 1 FROM public.places_search_cache)
     OR EXISTS(SELECT 1 FROM public.open_now_niche_cache) THEN
    RAISE EXCEPTION 'Never-authorized account can read tenant data';
  END IF;
  BEGIN
    INSERT INTO public.places_search_cache(
      user_id,location_key,city,state,segment,results
    ) VALUES (
      auth.uid(),'fake-noaccess|mg','Lavras','MG','Padaria','[]'::jsonb
    );
    RAISE EXCEPTION 'Never-authorized account inserted cached search';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Re-authorization must restore access to the ORIGINAL rows without
-- changing user_id or losing CRM data.
INSERT INTO public.private_access(user_id)
VALUES ('88888888-8888-8888-8888-888888888888');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','88888888-8888-8888-8888-888888888888',true);
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 1
     OR (SELECT SUM(amount) FROM public.lead_payments) <> 10
     OR NOT EXISTS(SELECT 1 FROM public.places_search_cache
                   WHERE location_key='fake-a|mg' AND page_count=2)
     OR (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 1 THEN
    RAISE EXCEPTION 'Reauthorization did not restore preserved original data';
  END IF;
END $$;
RESET ROLE;

-- Privileged maintenance by service_role remains intact and is not
-- subject to the client's allowlist RLS policies.
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 2
     OR (SELECT COUNT(*) FROM public.places_search_cache) <> 2
     OR (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 2 THEN
    RAISE EXCEPTION 'service_role access or source data was altered unexpectedly';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
SELECT 'Proposed RLS: two tenants, revocation, reauthorization and service_role verified' AS result;
