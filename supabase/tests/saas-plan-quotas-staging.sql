-- Executar SOMENTE no Supabase Staging depois das duas migrations SaaS.
-- Todos os dados fictícios são descartados no ROLLBACK.
begin;
do $$
declare
  u uuid;
  r jsonb;
  ids text[];
begin
  select id into u from auth.users order by created_at limit 1;
  if u is null then raise exception 'Staging sem usuário de teste'; end if;
  if (select count(*) from public.saas_plans) <> 3 then
    raise exception 'Esperados tres planos';
  end if;
  if not has_function_privilege('service_role','public.claim_daily_leads_for_user(uuid,text[])','EXECUTE')
     or has_function_privilege('authenticated','public.claim_daily_leads_for_user(uuid,text[])','EXECUTE')
     or has_function_privilege('anon','public.claim_daily_leads_for_user(uuid,text[])','EXECUTE')
     or has_table_privilege('authenticated','public.saas_subscriptions','UPDATE') then
    raise exception 'Permissoes inseguras';
  end if;

  select array_agg('testplan' || lpad(i::text,3,'0') order by i)
  into ids from generate_series(1,8) i;
  r := public.claim_daily_leads_for_user(u,ids);
  if (r->>'daily_limit')::integer <> 5
     or (r->>'newly_unlocked')::integer <> 5
     or (r->>'used_today')::integer <> 5 then
    raise exception 'Limite Free falhou: %',r;
  end if;

  r := public.claim_daily_leads_for_user(u,
    array['testplan001','testplan002','testplan002']);
  if (r->>'newly_unlocked')::integer <> 0
     or jsonb_array_length(r->'allowed_place_ids') <> 2 then
    raise exception 'Deduplicacao falhou: %',r;
  end if;

  insert into public.saas_subscriptions
    (user_id, plan_code, status, period_start, period_end)
  values (u,'pro','active',now(),now()+interval '30 days');
  select array_agg('testplan' || lpad(i::text,3,'0') order by i)
  into ids from generate_series(9,35) i;
  r := public.claim_daily_leads_for_user(u,ids);
  if (r->>'daily_limit')::integer <> 25
     or (r->>'used_today')::integer <> 25
     or (r->>'newly_unlocked')::integer <> 20 then
    raise exception 'Limite Pro falhou: %',r;
  end if;

  update public.saas_subscriptions set plan_code='advanced' where user_id=u;
  select array_agg('testplan' || lpad(i::text,3,'0') order by i)
  into ids from generate_series(36,100) i;
  r := public.claim_daily_leads_for_user(u,ids);
  if (r->>'daily_limit')::integer <> 70
     or (r->>'used_today')::integer <> 70
     or (r->>'newly_unlocked')::integer <> 45 then
    raise exception 'Limite Advanced falhou: %',r;
  end if;

  update public.saas_subscriptions set status='canceled' where user_id=u;
  r := public.claim_daily_leads_for_user(u,array['testplan101']);
  if (r->>'plan') <> 'free' or (r->>'newly_unlocked')::integer <> 0 then
    raise exception 'Cancelamento nao reverteu Free: %',r;
  end if;
  raise notice 'PASS: ACL, Free5, Pro25, Advanced70, dedupe e cancelamento';
end $$;
rollback;
