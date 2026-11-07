-- Ensaio sem custo para as cotas da busca; STAGING SOMENTE.
-- Todos os consumos e assinaturas ficticios sao revertidos por ROLLBACK.
begin;
do $$
declare
 v_user uuid;
 v_peek jsonb;
 v_claim jsonb;
 v_ids text[];
begin
 select user_id into v_user from public.private_access limit 1;
 if v_user is null then raise exception 'Staging sem usuario autorizado'; end if;
 if has_function_privilege('authenticated','public.peek_daily_leads_for_user(uuid)','EXECUTE')
   or has_function_privilege('anon','public.peek_daily_leads_for_user(uuid)','EXECUTE')
   or not has_function_privilege('service_role','public.peek_daily_leads_for_user(uuid)','EXECUTE')
 then raise exception 'Preflight sem ACL exclusiva do service_role'; end if;

 if public.peek_daily_leads_for_user(gen_random_uuid()) is not null then
   raise exception 'Preflight aceitou usuario sem private_access';
 end if;
 v_peek:=public.peek_daily_leads_for_user(v_user);
 if (v_peek->>'plan') <> 'free'
    or (v_peek->>'remaining_today')::int <> 5
    or (v_peek->>'lead_enrichment')::boolean then
   raise exception 'Preflight Free incorreto: %',v_peek;
 end if;

 select array_agg('fixture-live-quota-'||lpad(i::text,3,'0') order by i)
 into v_ids from generate_series(1,20) i;
 v_claim:=public.claim_daily_leads_for_user(v_user,v_ids);
 if (v_claim->>'newly_unlocked')::int <> 5
 or jsonb_array_length(v_claim->'allowed_place_ids') <> 5
 or (v_claim->>'remaining_today')::int <> 0 then
   raise exception 'Busca Free nao filtrou o lote para 5 leads: %',v_claim;
 end if;
 v_peek:=public.peek_daily_leads_for_user(v_user);
 if (v_peek->>'remaining_today')::int <> 0 then
   raise exception 'Preflight nao interrompe novas consultas';
 end if;
 v_claim:=public.claim_daily_leads_for_user(v_user,array['fixture-live-quota-001','fixture-live-quota-001','fixture-live-quota-021']);
 if (v_claim->>'newly_unlocked')::int <> 0 or
   jsonb_array_length(v_claim->'allowed_place_ids') <> 1 then
   raise exception 'Duplicatas/limite nao foram respeitados: %',v_claim;
 end if;

 insert into public.saas_subscriptions(user_id,plan_code,status,period_start,period_end)
 values(v_user,'pro','active',now(),now()+interval '30 days');
 v_peek:=public.peek_daily_leads_for_user(v_user);
 if (v_peek->>'plan') <> 'pro' or (v_peek->>'remaining_today')::int <> 20 or
    not (v_peek->>'lead_enrichment')::boolean then
  raise exception 'Preflight Pro incorreto: %',v_peek;
 end if;

 update public.saas_subscriptions set plan_code='advanced' where user_id=v_user;
 v_peek:=public.peek_daily_leads_for_user(v_user);
 if (v_peek->>'plan') <> 'advanced' or (v_peek->>'daily_limit')::int <> 70 or
   (v_peek->>'remaining_today')::int <> 65 then
  raise exception 'Preflight Advanced incorreto: %',v_peek;
 end if;

 update public.saas_subscriptions set status='canceled' where user_id=v_user;
 v_peek:=public.peek_daily_leads_for_user(v_user);
 if (v_peek->>'plan') <> 'free' or (v_peek->>'remaining_today')::int <> 0 then
  raise exception 'Cancelamento nao reverteu para Free: %',v_peek;
 end if;

 raise notice 'PASS: preflight restrito, negacao sem acesso, Free 5, Pro 25, Advanced 70, duplicatas, cancelamento';
end $$;
rollback;