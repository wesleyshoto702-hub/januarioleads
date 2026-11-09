-- Staging only, read-only security assertions.
DO $audit$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
  WHERE s.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  IF n<>0 THEN RAISE EXCEPTION 'Some public tables have RLS disabled: %',n; END IF;

  SELECT count(*) INTO n
  FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
  WHERE s.nspname='public' AND p.prosecdef AND
    (has_function_privilege('anon',p.oid,'EXECUTE')
      OR has_function_privilege('authenticated',p.oid,'EXECUTE'));
  IF n<>0 THEN RAISE EXCEPTION 'Client-executable security-definer functions: %',n; END IF;

  IF has_table_privilege('anon','public.leads','INSERT') OR
     has_table_privilege('anon','public.lead_payments','INSERT') OR
     has_table_privilege('anon','public.private_access','INSERT') OR
     has_table_privilege('authenticated','public.private_access','INSERT') OR
     has_table_privilege('authenticated','public.business_enrichment_facts','INSERT') OR
     has_table_privilege('authenticated','public.sync_internal_config','SELECT')
  THEN RAISE EXCEPTION 'Excessive direct table privileges'; END IF;

  IF NOT has_table_privilege('authenticated','public.leads','INSERT') OR
     NOT has_table_privilege('authenticated','public.private_access','SELECT') OR
     NOT has_table_privilege('service_role','public.private_access','INSERT')
  THEN RAISE EXCEPTION 'Legitimate privileges were inadvertently revoked'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND
     tablename='leads' AND cmd='UPDATE' AND roles @> ARRAY['authenticated']::name[]
     AND qual like '%auth.uid%' AND with_check like '%auth.uid%')
  THEN RAISE EXCEPTION 'CRM UPDATE ownership checks missing'; END IF;
END
$audit$;
