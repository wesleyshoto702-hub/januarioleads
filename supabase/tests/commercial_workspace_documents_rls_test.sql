-- Run with supabase test db (pgTAP installed by the test runner).
-- Does not modify production data; this file runs inside a transaction.
begin;
set local search_path to public,extensions;
select plan(10);

select ok(
 (select relrowsecurity from pg_class where oid='public.commercial_workspace_documents'::regclass),
 'Cloud commercial documents enforce row-level security'
);
select ok(
 not has_table_privilege('anon','public.commercial_workspace_documents','SELECT'),
 'Anonymous callers cannot read cloud documents'
);
select ok(
 not has_table_privilege('anon','public.commercial_workspace_documents','INSERT'),
 'Anonymous callers cannot create cloud documents'
);
select ok(
 not has_table_privilege('anon','public.commercial_workspace_documents','UPDATE'),
 'Anonymous callers cannot update cloud documents'
);
select ok(
 not has_table_privilege('authenticated','public.commercial_workspace_documents','DELETE'),
 'Authenticated users cannot delete whole documents'
);
select ok(
 has_table_privilege('authenticated','public.commercial_workspace_documents','SELECT'),
 'Signed-in users can attempt authorized reads'
);
select ok(
 has_table_privilege('authenticated','public.commercial_workspace_documents','INSERT'),
 'Signed-in users can attempt authorized inserts'
);
select ok(
 has_table_privilege('authenticated','public.commercial_workspace_documents','UPDATE'),
 'Signed-in users can attempt authorized updates'
);
select is(
 (select count(*)::integer from pg_policies where schemaname='public'
  and tablename='commercial_workspace_documents'),3,
 'Each authenticated read, insert, and update has a dedicated ownership policy'
);
select ok(
 not has_table_privilege('authenticated','public.commercial_workspace_documents','TRUNCATE'),
 'No client may truncate the table'
);
select * from finish();
rollback;
