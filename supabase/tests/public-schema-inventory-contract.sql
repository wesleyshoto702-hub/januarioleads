-- ONLY for the isolated PostgreSQL 17 schema fixture used by CI.
-- Metadata contract captured by read-only SQL in Supabase on 2026-11-05.
-- This does NOT claim auth/storage/Cron/Vault equivalence or identical DDL.
-- Never apply test fixtures directly to the linked Supabase project.

DO $contract$
DECLARE
  v_drift text;
BEGIN
  WITH expected(tablename, policy_count, index_count) AS (
    VALUES
      ('api_request_rate_limit',          1, 1),
      ('business_enrichment_facts',        1, 3),
      ('business_enrichment_runs',         1, 3),
      ('business_enrichment_sources',      1, 2),
      ('lead_activities',                 4, 4),
      ('lead_payments',                   2, 3),
      ('lead_updates',                    2, 3),
      ('leads',                           4, 5),
      ('open_now_niche_cache',            1, 2),
      ('open_now_refresh_guard',          1, 1),
      ('places_search_cache',             3, 3),
      ('private_access',                  1, 1),
      ('prompt_visual_reference_assets',  3, 4),
      ('prompt_visual_reference_sets',    4, 2),
      ('prompt_visual_references',         4, 7),
      ('site_previews',                   4, 2),
      ('sync_internal_config',            1, 1)
  ),
  observed AS (
    SELECT
      t.tablename,
      t.rowsecurity,
      (SELECT count(*)::int FROM pg_policies p
       WHERE p.schemaname='public' AND p.tablename=t.tablename) as policy_count,
      (SELECT count(*)::int FROM pg_indexes i
       WHERE i.schemaname='public' AND i.tablename=t.tablename) as index_count
    FROM pg_tables t WHERE t.schemaname='public'
  )
  SELECT string_agg(coalesce(e.tablename,o.tablename), ', ' ORDER BY coalesce(e.tablename,o.tablename))
    INTO v_drift
  FROM expected e FULL OUTER JOIN observed o USING(tablename)
  WHERE e.tablename IS NULL OR o.tablename IS NULL OR
        o.rowsecurity IS DISTINCT FROM true OR
        o.policy_count IS DISTINCT FROM e.policy_count OR
        o.index_count IS DISTINCT FROM e.index_count;

  IF v_drift IS NOT NULL THEN
    RAISE EXCEPTION 'Baseline public catalog metadata differs from production snapshot: %', v_drift;
  END IF;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public') <> 4 THEN
    RAISE EXCEPTION 'Baseline does not have four public SQL functions';
  END IF;

  IF (SELECT count(*) FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'Baseline does not have two user-defined public triggers';
  END IF;
END;
$contract$;

SELECT 'Public catalog metadata matches the recorded 2026-11-05 inventory' AS result;
