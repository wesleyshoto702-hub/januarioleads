-- STRICT READ-ONLY PREFLIGHT for RLS candidate PR #36.
-- Public metadata only, captured from Supabase on 2026-11-05.
-- Returns exactly PASS or BLOCKED. Never updates production.
-- Run before any approved deployment. BLOCKED means STOP and investigate,
-- never drop policies, disable RLS or repair the ledger to bypass failure.
-- For a local disposable DB, baseline metadata should match this inventory.
WITH expected(tablename, policyname, cmd, using_md5, check_md5) AS (
  VALUES
    ('lead_payments', 'Users can add own lead payments', 'INSERT', 'd41d8cd98f00b204e9800998ecf8427e', 'f1df5cb3a8cf1dfce67f96a3aab52bde'),
    ('lead_payments', 'Users can read own lead payments', 'SELECT', 'ff452c766f1dd1d84c376129b36406c1', 'd41d8cd98f00b204e9800998ecf8427e'),
    ('open_now_niche_cache', 'Users can read own open now cache', 'SELECT', 'ff452c766f1dd1d84c376129b36406c1', 'd41d8cd98f00b204e9800998ecf8427e'),
    ('places_search_cache', 'Users can insert own places search cache', 'INSERT', 'd41d8cd98f00b204e9800998ecf8427e', 'ff452c766f1dd1d84c376129b36406c1'),
    ('places_search_cache', 'Users can read own places search cache', 'SELECT', 'ff452c766f1dd1d84c376129b36406c1', 'd41d8cd98f00b204e9800998ecf8427e'),
    ('places_search_cache', 'Users can update own places search cache', 'UPDATE', 'ff452c766f1dd1d84c376129b36406c1', 'ff452c766f1dd1d84c376129b36406c1'),
    ('private_access', 'private_access_select_self', 'SELECT', 'ff452c766f1dd1d84c376129b36406c1', 'd41d8cd98f00b204e9800998ecf8427e')
),
actual AS (
  SELECT tablename,policyname,cmd,permissive,roles::text AS roles,
         md5(coalesce(qual,'')) AS using_md5,
         md5(coalesce(with_check,'')) AS check_md5
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN (
      'lead_payments','places_search_cache',
      'open_now_niche_cache','private_access'
    )
),
policy_drift AS (
  SELECT coalesce(e.tablename,a.tablename) AS tablename
  FROM expected e FULL JOIN actual a USING (tablename,policyname)
  WHERE e.tablename IS NULL OR a.tablename IS NULL
     OR e.cmd IS DISTINCT FROM a.cmd
     OR a.permissive IS DISTINCT FROM 'PERMISSIVE'
     OR a.roles IS DISTINCT FROM '{authenticated}'
     OR e.using_md5 IS DISTINCT FROM a.using_md5
     OR e.check_md5 IS DISTINCT FROM a.check_md5
),
rls_check AS (
  SELECT count(*) = 4
    AND bool_and(rowsecurity) AS ok
  FROM pg_tables
  WHERE schemaname='public'
    AND tablename IN (
      'lead_payments','places_search_cache',
      'open_now_niche_cache','private_access'
    )
),
grant_check AS (
  SELECT
    count(*) FILTER (WHERE grantee='anon')=0
    AND count(*) FILTER (WHERE grantee='authenticated' AND privilege_type='SELECT')=4
    AND count(*) FILTER (WHERE grantee='authenticated' AND privilege_type='INSERT')=2
    AND count(*) FILTER (WHERE grantee='authenticated' AND privilege_type='UPDATE')=1
    AND count(*) FILTER (WHERE grantee='authenticated' AND privilege_type NOT IN ('SELECT','INSERT','UPDATE'))=0
    AS ok
  FROM information_schema.role_table_grants
  WHERE table_schema='public'
    AND table_name IN (
      'lead_payments','places_search_cache',
      'open_now_niche_cache','private_access'
    )
    AND grantee IN ('authenticated','anon')
)
SELECT CASE
  WHEN (SELECT count(*)=0 FROM policy_drift)
   AND (SELECT ok FROM rls_check)
   AND (SELECT ok FROM grant_check)
  THEN 'PASS' ELSE 'BLOCKED'
END AS release_preflight;
