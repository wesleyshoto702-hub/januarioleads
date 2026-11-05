-- READ-ONLY POSTCHECK for a future authorized deployment of PR #36.
-- Run against disposable staging after the RLS candidate, then in
-- production ONLY IF a separate deployment has been expressly approved.
-- All five selected policies must enforce ownership + private_access.
WITH expected(tablename,policyname,cmd,check_using,check_insert) AS (
 VALUES
  ('lead_payments','Users can read own lead payments','SELECT',true,false),
  ('open_now_niche_cache','Users can read own open now cache','SELECT',true,false),
  ('places_search_cache','Users can read own places search cache','SELECT',true,false),
  ('places_search_cache','Users can insert own places search cache','INSERT',false,true),
  ('places_search_cache','Users can update own places search cache','UPDATE',true,true)
),
actual AS (
 SELECT tablename,policyname,cmd,permissive,roles::text AS roles,qual,with_check
 FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('lead_payments','open_now_niche_cache','places_search_cache')
),
violations AS (
 SELECT coalesce(e.tablename,a.tablename) AS target
 FROM expected e FULL JOIN actual a USING(tablename,policyname)
 WHERE
   (e.tablename IS NULL AND a.policyname <> 'Users can add own lead payments')
   OR (a.tablename IS NULL)
   OR (e.tablename IS NOT NULL AND (
      e.cmd IS DISTINCT FROM a.cmd
      OR a.permissive IS DISTINCT FROM 'PERMISSIVE'
      OR a.roles IS DISTINCT FROM '{authenticated}'
      OR (e.check_using AND
          (coalesce(a.qual,'') NOT ILIKE '%private_access%'
            OR coalesce(a.qual,'') NOT ILIKE '%auth.uid%'))
      OR (e.check_insert AND
          (coalesce(a.with_check,'') NOT ILIKE '%private_access%'
            OR coalesce(a.with_check,'') NOT ILIKE '%auth.uid%'))
   ))
),
unchanged_payment_insert AS (
 SELECT count(*)=1 AS ok
 FROM actual
 WHERE tablename='lead_payments'
  AND policyname='Users can add own lead payments'
  AND cmd='INSERT' AND permissive='PERMISSIVE'
  AND roles='{authenticated}'
  AND md5(coalesce(with_check,''))='f1df5cb3a8cf1dfce67f96a3aab52bde'
),
all_rls AS (
 SELECT count(*)=4 AND bool_and(rowsecurity) AS ok
 FROM pg_tables WHERE schemaname='public' AND tablename IN
 ('private_access','lead_payments','open_now_niche_cache','places_search_cache')
)
SELECT CASE
 WHEN (SELECT count(*)=0 FROM violations)
  AND (SELECT count(*)=6 FROM actual)
  AND (SELECT ok FROM unchanged_payment_insert)
  AND (SELECT ok FROM all_rls)
 THEN 'PASS' ELSE 'BLOCKED'
END AS postcheck;
