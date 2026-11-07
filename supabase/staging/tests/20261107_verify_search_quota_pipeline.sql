-- Teste transacional da integracao de cotas na busca.
-- Executar SOMENTE no Supabase Staging. Nenhuma alteracao persiste.
begin;
do $$
declare
  u uuid;
  q jsonb;
  c jsonb;
  ids text[];
begin
  select user_id into u from public.private_access limit 1;
  if u is null then raise exception 'Falta conta de teste autorizada'; end if;
  if has_function_privilege('authenticated','public.peek_daily_leads_for_user(uuid)','EXECUTE') or
     has_function_privilege('anon','public.peek_daily_leads_for_user(uuid)','EXECUTE') or
     not has_function_privilege('service_role','public.peek_daily_leads_for_user(uuid)','EXECUTE') then
    raise exception 'RPC de consulta da cota ficou exposta a clientes';
  end if;

  q := public.peek_daily_leads_for_user(u);
  if (q->>'plan') <> 'free' or (q->>'remaining_today')::integer <> 5 then
    raise exception 'Saldo Free inicial invalido: %', q;
  end if;

  select array_agg('quota-integration-fixture-' || i order by i)
  into ids from generate_series(1, 8) i;
  c := public.claim_daily_leads_for_user(u,ids);
  if (c->>'newly_unlocked')::integer <> 5 or
     jsonb_array_length(c->'allowed_place_ids') <> 5 then
    raise exception 'Free liberou mais de 5 empresas: %', c;
  end if;

  q := public.peek_daily_leads_for_user(u);
  if (q->>'remaining_today')::integer <> 0 then
    raise exception 'Preflight deveria bloquear quando a cota termina: %',q;
  end if;

  c := public.claim_daily_leads_for_user(u, array[
    'quota-integration-fixture-1','quota-integration-fixture-1',
    'quota-integration-fixture-2','quota-integration-fixture-9'
  ]);
  if (c->>'newly_unlocked')::integer <> 0 or
    jsonb_array_length(c->'allowed_place_ids') <> 2 then
    raise exception 'Repeticao nao foi idempotente: %',c;
  end if;

  insert into public.saas_subscriptions(user_id,plan_code,status,period_start,period_end)
  values(u,'pro','active',now(),now()+interval '30 days');
  q := public.peek_daily_leads_for_user(u);
  if (q->>'plan') <> 'pro' or (q->>'remaining_today')::integer <> 20 then
    raise exception 'Upgrade Pro sem recalculo do saldo: %',q;
  end if;
  update public.saas_subscriptions set plan_code='advanced' where user_id=u;
  q := public.peek_daily_leads_for_user(u);
  if (q->>'plan') <> 'advanced' or (q->>'remaining_today')::integer <> 65 then
    raise exception 'Upgrade Advanced sem recalculo: %',q;
  end if;
  update public.saas_subscriptions set status='canceled' where user_id=u;
  q := public.peek_daily_leads_for_user(u);
  if (q->>'plan') <> 'free' or (q->>'remaining_today')::integer <> 0 then
    raise exception 'Cancelamento nao voltou ao Free: %',q;
  end if;

  raise notice 'PASS: cota Free, preflight, pagina filtrada, repeticao, upgrades e cancelamento';
end $$;
rollback;
