-- Test-only: validates the proposed allowlist-based policies in a disposable
-- PostgreSQL instance; DOES NOT connect to Supabase production or change data.
begin;

insert into auth.users(id)
values ('88888888-8888-8888-8888-888888888888');

insert into public.private_access(user_id)
values ('88888888-8888-8888-8888-888888888888');

-- Create representative records through the authenticated role, exercising
-- the same grants and RLS as PostgREST would use for an authorized account.
set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);

insert into public.leads(id, user_id, company, segment, first_contact)
values (
  '88888888-8888-8888-8888-888888888889',
  auth.uid(), 'Empresa fictícia', 'Teste', current_date
);

insert into public.lead_payments(lead_id, user_id, amount, payment_method)
values ('88888888-8888-8888-8888-888888888889', auth.uid(), 10, 'pix');

insert into public.places_search_cache(user_id, location_key, city, state, segment, results)
values (auth.uid(), 'lavras|mg', 'Lavras', 'MG', 'Restaurante', '[]'::jsonb);

reset role;

-- This legacy cache is service-written; only the client SELECT is exposed.
insert into public.open_now_niche_cache(
  user_id, location_key, city, state, segment, family
)
values (
  '88888888-8888-8888-8888-888888888888',
  'lavras|mg', 'Lavras', 'MG', 'Restaurante', 'Alimentação'
);

set local role authenticated;
do $$ begin
  if (select count(*) from public.lead_payments) <> 1 then
    raise exception 'Allowlisted owner cannot read payments';
  end if;
  if (select count(*) from public.places_search_cache) <> 1 then
    raise exception 'Allowlisted owner cannot read places cache';
  end if;
  if (select count(*) from public.open_now_niche_cache) <> 1 then
    raise exception 'Allowlisted owner cannot read open-now cache';
  end if;
  update public.places_search_cache set page_count = 2;
  if (select page_count from public.places_search_cache limit 1) <> 2 then
    raise exception 'Allowlisted owner cannot update places cache';
  end if;
end $$;
reset role;

-- Revoke access without deleting the JWT, user or historical records.
delete from public.private_access
where user_id = '88888888-8888-8888-8888-888888888888';

set local role authenticated;
do $$
declare
  updated_rows integer;
begin
  if exists (select 1 from public.lead_payments) then
    raise exception 'Revoked account can read financial CRM records';
  end if;
  if exists (select 1 from public.places_search_cache) then
    raise exception 'Revoked account can read places cache';
  end if;
  if exists (select 1 from public.open_now_niche_cache) then
    raise exception 'Revoked account can read open-now cache';
  end if;

  update public.places_search_cache set page_count = 3;
  get diagnostics updated_rows = row_count;
  if updated_rows <> 0 then
    raise exception 'Revoked account updated own places cache';
  end if;

  begin
    insert into public.places_search_cache(
      user_id, location_key, city, state, segment, results
    ) values (
      auth.uid(), 'lavras-mg-alt', 'Lavras', 'MG', 'Academia', '[]'::jsonb
    );
    raise exception 'Revoked account inserted a places cache entry';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- A service role must still be able to perform authorized maintenance.
set local role service_role;
do $$ begin
  if (select count(*) from public.lead_payments) <> 1 then
    raise exception 'service_role lost payment access after revoke';
  end if;
  if (select count(*) from public.places_search_cache) <> 1 then
    raise exception 'service_role lost places cache access after revoke';
  end if;
end $$;
reset role;

rollback;
select 'Proposed access-revocation RLS checks passed on disposable database' as result;
