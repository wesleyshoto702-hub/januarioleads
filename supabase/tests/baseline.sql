BEGIN;
INSERT INTO auth.users VALUES ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
INSERT INTO public.private_access(user_id) SELECT id FROM auth.users WHERE id <> '33333333-3333-3333-3333-333333333333';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',true);
INSERT INTO public.leads(id,user_id,company,segment,first_contact) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),'Test A','Test',current_date);
INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),10,'pix');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.lead_activities) <> 1 THEN RAISE EXCEPTION 'Lead trigger failed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',true);
INSERT INTO public.leads(id,user_id,company,segment,first_contact) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',auth.uid(),'Test B','Test',current_date);
DO $$ DECLARE n integer; BEGIN
 IF (SELECT count(*) FROM public.leads) <> 1 OR EXISTS(SELECT 1 FROM public.leads WHERE company='Test A') THEN RAISE EXCEPTION 'Lead read isolation failed'; END IF;
 IF (SELECT count(*) FROM public.lead_activities) <> 1 THEN RAISE EXCEPTION 'Activity isolation failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.lead_payments) THEN RAISE EXCEPTION 'Payment isolation failed'; END IF;
 UPDATE public.leads SET company='Wrong' WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Cross-account update'; END IF;
 DELETE FROM public.leads WHERE id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 GET DIAGNOSTICS n = ROW_COUNT; IF n <> 0 THEN RAISE EXCEPTION 'Cross-account delete'; END IF;
 BEGIN
 INSERT INTO public.lead_payments(lead_id,user_id,amount,payment_method) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',auth.uid(),10,'pix');
 RAISE EXCEPTION 'Cross-account payment accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 INSERT INTO public.leads(id,user_id,company,segment,first_contact) VALUES (gen_random_uuid(),'11111111-1111-1111-1111-111111111111','Wrong','Test',current_date);
 RAISE EXCEPTION 'Cross-account insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.leads) THEN RAISE EXCEPTION 'Unapproved account read'; END IF;
 BEGIN
 INSERT INTO public.leads(id,user_id,company,segment,first_contact) VALUES (gen_random_uuid(),auth.uid(),'Wrong','Test',current_date);
 RAISE EXCEPTION 'Unapproved account insert';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.leads) <> 2 THEN RAISE EXCEPTION 'Fixture corrupted'; END IF;
 IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity) THEN RAISE EXCEPTION 'Missing RLS'; END IF;
END $$;
ROLLBACK;
SELECT 'Baseline isolation checks passed' AS result;
