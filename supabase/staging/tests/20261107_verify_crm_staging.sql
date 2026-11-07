-- Testes transacionais do CRM em Supabase STAGING.
-- Nunca executar em producao. Todos os leads ficticios sao revertidos com ROLLBACK.
-- Pre-requisito: exatamente um usuario Gmail confirmado com private_access em Staging.
begin;
do $$
declare
  v_authorized uuid;
  v_id uuid := gen_random_uuid();
  v_count integer;
begin
  select user_id into v_authorized from public.private_access limit 1;
  if v_authorized is null then raise exception 'Conta de teste nao autorizada'; end if;
  if (select count(*) from public.private_access) <> 1 then
    raise exception 'Esperado somente um usuario autorizado em Staging';
  end if;
  if (select count(*) from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r'
      and c.relname not like 'saas_%') <> 17 then
    raise exception 'Esperadas 17 tabelas CRM no staging';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
  ) then raise exception 'Uma tabela do staging esta sem RLS'; end if;
  if has_function_privilege('anon','public.claim_api_request_for_user(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.claim_api_request_for_user(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.claim_open_now_refresh(uuid,text,integer,integer)','EXECUTE')
    or not has_function_privilege('service_role','public.claim_api_request_for_user(uuid,text)','EXECUTE')
  then raise exception 'Permissoes de funcoes internas incorretas'; end if;

  perform set_config('request.jwt.claim.sub', v_authorized::text, true);
  execute 'set local role authenticated';
  insert into public.leads (id,user_id,company,segment,first_contact)
  values (v_id,auth.uid(),'CRM TEST FIXTURE NAO PERSISTIR','Teste',current_date);
  select count(*) into v_count from public.leads where id=v_id;
  if v_count <> 1 then raise exception 'Usuario nao consegue ler proprio lead'; end if;
  select count(*) into v_count from public.lead_activities
  where lead_id=v_id and user_id=v_authorized and type='lead_added';
  if v_count <> 1 then raise exception 'Trigger de atividade nao funcionou'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  select count(*) into v_count from public.private_access;
  if v_count <> 0 then raise exception 'Outro usuario viu private_access'; end if;
  select count(*) into v_count from public.leads where id=v_id;
  if v_count <> 0 then raise exception 'Outro usuario viu lead privado'; end if;
  update public.leads set company='TENTATIVA INVALIDA' where id=v_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'Outro usuario alterou lead privado'; end if;
  raise notice 'PASS: staging 17 CRM tables; all RLS; ACL; insert and activity; cross-user isolation';
end $$;
rollback;

begin;
do $$
declare
  v_user uuid;
  v_allow boolean;
begin
  select user_id into v_user from public.private_access limit 1;
  v_allow := public.claim_api_request_for_user(v_user,'places_search');
  if not v_allow then raise exception 'Busca Places bloqueada no Staging'; end if;
  v_allow := public.claim_api_request_for_user(v_user,'presence_site');
  if not v_allow then raise exception 'Bucket presence_site ausente'; end if;
  v_allow := public.claim_api_request_for_user(v_user,'invalid_bucket_fixture');
  if v_allow then raise exception 'Bucket desconhecido liberado'; end if;
  raise notice 'PASS: service-only API request quotas; places_search/presence_site';
end $$;
rollback;
