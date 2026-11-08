-- Rollback-only: keep duplicate recognition after daily wallet rollover.
begin;
do $$
declare
  u uuid;
  seed text := replace(gen_random_uuid()::text,'-','');
  osm text;
  google text;
  osms jsonb;
  googles jsonb;
begin
  select user_id into u from public.private_access limit 1;
  if u is null then raise exception 'No authorized staging identity'; end if;
  osm := 'geoapify:historic'||seed;
  google := 'ChIJhistoric'||seed;
  insert into public.leads
    (id,user_id,company,segment,phone,status,first_contact,notes,
     place_id,city,state,address,latitude,longitude,created_at)
  values
    (gen_random_uuid(),u,'Barbearia Histórica','Barbearia','',
     'send_message',current_date,'OSM test record',osm,'Lavras','MG',
     'Rua do Teste, 1',-21.245,-44.99,now()-interval '3 days'),
    (gen_random_uuid(),u,'Cliente definido pelo usuário','Barbearia','',
     'send_message',current_date,'Google Place ID record',google,
     null,null,null,null,null,now()-interval '3 days');

  select public.get_daily_geoapify_anchors_for_user(u) into osms;
  select public.get_daily_google_credit_ids_for_user(u) into googles;
  if not exists(select 1 from jsonb_array_elements(osms) as x
    where x->>'sourceId'=osm
      and x->>'name'='Barbearia Histórica') then
    raise exception 'Historical OSM CRM identity not retrieved';
  end if;
  if not (googles ? google) then
    raise exception 'Historical Google Place ID not retrieved';
  end if;

  -- Historical CRM identity does not automatically grant a free credit TODAY.
  update public.saas_subscriptions set status='canceled' where user_id=u;
  -- No credit waiver is inserted just by reading stored CRM identities.
  if exists(select 1 from public.saas_daily_credit_leads
    where user_id=u and place_id in (osm,google)) then
    raise exception 'History lookup incorrectly modified credit wallet';
  end if;
end $$;
rollback;
