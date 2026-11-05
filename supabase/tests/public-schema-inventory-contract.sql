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

  -- Compare all public column positions, names, data types, nullability,
  -- identity and generated markers by hash (no rows or defaults exported).
  -- This is stronger than counts but still NOT a full schema/DDL diff.
  WITH expected(table_name, column_count, fingerprint) AS (
    VALUES
      ('api_request_rate_limit', 5, '117e712f62ccdffbfa1789ba24ce5376'),
      ('business_enrichment_facts', 18, '3d591c6eaaef69e003a59df00bd5ee75'),
      ('business_enrichment_runs', 28, '4a14b3f3474b3236ce4d02d3e865bf3c'),
      ('business_enrichment_sources', 25, 'c84093660a62f681e3029cb86bd09109'),
      ('lead_activities', 8, '080ba203ac0474f7d813dd75eaaa76fd'),
      ('lead_payments', 9, '2048b09e73f6f58a77cc3492f57c697e'),
      ('lead_updates', 13, 'de4b64d51bb859027da7f773372cd007'),
      ('leads', 58, '04dccbd7227b68664960da535bd023ae'),
      ('open_now_niche_cache', 17, 'a461eab07e94f47e257edaea46fdeb3e'),
      ('open_now_refresh_guard', 5, 'e6eb5860c73b9ef57b633c3051be616b'),
      ('places_search_cache', 10, 'ea5b57b7f061d14424262949d13d6d1d'),
      ('private_access', 2, 'e3375ed6e665196d1938d564783ba312'),
      ('prompt_visual_reference_assets', 12, 'dc9b02d23ddc19d1a0b384cec25ffa09'),
      ('prompt_visual_reference_sets', 10, '504a869145ee6ac7afe17e45bf42c742'),
      ('prompt_visual_references', 24, '6ff6a7d4a12fa2998154b3b2bdffadb9'),
      ('site_previews', 10, '5fdc053d03b0d3d498069afe1999adf5'),
      ('sync_internal_config', 3, '6adb3de3822da8f7c91e1a734c837e2a')
  ),
  observed AS (
    SELECT table_name,COUNT(*)::int AS column_count,
      md5(string_agg(
        ordinal_position::text || '|' || column_name || '|' ||
        data_type || '|' || udt_name || '|' || is_nullable || '|' ||
        is_identity || '|' || is_generated,
        chr(10) ORDER BY ordinal_position
      )) AS fingerprint
    FROM information_schema.columns WHERE table_schema='public'
    GROUP BY table_name
  )
  SELECT string_agg(coalesce(e.table_name,o.table_name), ', ' ORDER BY coalesce(e.table_name,o.table_name))
    INTO v_drift
  FROM expected e FULL OUTER JOIN observed o USING(table_name)
  WHERE e.table_name IS NULL OR o.table_name IS NULL OR
    e.column_count IS DISTINCT FROM o.column_count OR
    e.fingerprint IS DISTINCT FROM o.fingerprint;
  IF v_drift IS NOT NULL THEN
    RAISE EXCEPTION 'Public column-layout fingerprint differs from production: %', v_drift;
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
