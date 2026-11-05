-- READ-ONLY migration ledger gate for Supabase project czkazbianiflhldenhcj.
-- Exact fingerprint captured on 2026-11-05. No migration statements exported.
-- This query is LIVE-ONLY: the disposable baseline does not include the
-- Supabase-managed migration ledger. Never change ledger records to pass.
WITH ledger AS (
 SELECT count(*)::integer AS total, max(version) AS last_version,
   md5(string_agg(
      version || '|' || name || '|' ||
      md5(coalesce(array_to_string(statements,E'\n'),'')),
      E'\n' ORDER BY version
   )) AS fingerprint
 FROM supabase_migrations.schema_migrations
)
SELECT CASE
  WHEN total=51 AND last_version='20261103220000'
    AND fingerprint='ef7e5322cd32dd08de9b039694d8b2a8'
  THEN 'PASS' ELSE 'BLOCKED'
END AS migration_ledger_preflight FROM ledger;
