-- SECURITY-REGRESSION BASELINE (DISPOSABLE POSTGRES ONLY)
--
-- Proves the pre-fix permission gap before applying the proposed policies.
-- Uses fictional accounts and runs inside a transaction rolled back in full.
-- Never run this fixture against a linked Supabase project or production.
BEGIN;

INSERT INTO auth.users(id) VALUES
  ('66666666-6666-6666-6666-666666666666'),
  ('77777777-7777-7777-7777-777777777777');

INSERT INTO public.private_access(user_id) VALUES
  ('66666666-6666-6666-6666-666666666666'),
  ('77777777-7777-7777-7777-777777777777');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',true);
INSERT INTO public.leads(id,user_id,company,segment,first_contact)
VALUES ('66666666-6666-6666-6666-666666666667',auth.uid(),'Empresa anterior - conta A','Teste',CURRENT_DATE);
INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method)
VALUES ('66666666-6666-6666-6666-666666666667',auth.uid(),10,'pix');
INSERT INTO public.places_search_cache(user_id,location_key,city,state,segment,results)
VALUES (auth.uid(),'pre-fix|mg','Lavras','MG','Restaurante','[]'::jsonb);
RESET ROLE;

-- open_now_niche_cache is not client-writable; seed as database owner.
INSERT INTO public.open_now_niche_cache(user_id,location_key,city,state,segment,family)
VALUES ('66666666-6666-6666-6666-666666666666','pre-fix|mg','Lavras','MG','Restaurante','Alimentação');

DELETE FROM public.private_access
WHERE user_id='66666666-6666-6666-6666-666666666666';

-- A revoked-but-unexpired JWT still resolves to this user. The known old
-- policies expose THEIR OWN three tables, not any other account's rows.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.lead_payments) <> 1 THEN
    RAISE EXCEPTION 'Historical payment policy gap is no longer reproduced';
  END IF;
  IF (SELECT COUNT(*) FROM public.places_search_cache) <> 1 THEN
    RAISE EXCEPTION 'Historical places-cache policy gap is no longer reproduced';
  END IF;
  IF (SELECT COUNT(*) FROM public.open_now_niche_cache) <> 1 THEN
    RAISE EXCEPTION 'Historical open-now policy gap is no longer reproduced';
  END IF;
  IF EXISTS(SELECT 1 FROM public.leads) THEN
    RAISE EXCEPTION 'Core leads RLS unexpectedly allows a revoked user';
  END IF;
END $$;

UPDATE public.places_search_cache SET page_count=2
WHERE user_id=auth.uid() AND location_key='pre-fix|mg';
DO $$ BEGIN
  IF (SELECT page_count FROM public.places_search_cache WHERE location_key='pre-fix|mg') <> 2 THEN
    RAISE EXCEPTION 'Historical revoked-account update gap not reproduced';
  END IF;
END $$;
INSERT INTO public.places_search_cache(user_id,location_key,city,state,segment,results)
VALUES (auth.uid(),'pre-fix-alt|mg','Lavras','MG','Academia','[]'::jsonb);
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.places_search_cache) <> 2 THEN
    RAISE EXCEPTION 'Historical revoked-account insert gap not reproduced';
  END IF;
END $$;
RESET ROLE;

ROLLBACK;
SELECT 'Historical revoked-account policy gap reproduced in isolated baseline' AS result;
