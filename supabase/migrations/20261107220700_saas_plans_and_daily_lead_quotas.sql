-- Januario Leads: fase 1 do SaaS, homologada inicialmente SOMENTE em Staging.
-- Nao concede acesso ao CRM, nao cobra usuarios e nao altera as quotas antigas da API Google.
-- Mantenha a migracao fora da producao ate revisao de isolamento, backfill e gateway.

create table public.saas_plans (
  code text primary key check (code in ('free', 'pro', 'advanced')),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  daily_lead_limit integer not null check (daily_lead_limit between 0 and 10000),
  active boolean not null default true
);

insert into public.saas_plans (code, name, price_cents, daily_lead_limit)
values
  ('free', 'Free', 0, 5),
  ('pro', 'Pro', 1490, 25),
  ('advanced', 'Advanced', 2990, 70);

create table public.saas_plan_features (
  plan_code text not null references public.saas_plans(code) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  enabled boolean not null,
  primary key (plan_code, feature_key)
);

-- As flags sao um contrato de produto futuro; o frontend/Edge Functions ainda precisarao aplica-las.
insert into public.saas_plan_features (plan_code, feature_key, enabled)
select p.code, f.key,
  case
    when f.key in ('crm', 'basic_messages', 'manual_followup') then true
    when p.code = 'free' then false
    when p.code = 'pro' then f.key in
      ('kanban', 'custom_messages', 'followup_center', 'finance', 'lead_enrichment')
    else true
  end
from public.saas_plans p
cross join (
  values
    ('crm'), ('basic_messages'), ('manual_followup'), ('kanban'),
    ('custom_messages'), ('followup_center'), ('finance'),
    ('lead_enrichment'), ('advanced_reports'),
    ('internal_automations'), ('advanced_lead_prioritization')
) as f(key);

-- Sem assinatura ativa e vigente, o usuario e Free. Somente o backend confiavel
-- pode criar/atualizar assinaturas depois da confirmacao do provedor.
create table public.saas_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null references public.saas_plans(code),
  status text not null check (status in ('active', 'past_due', 'canceled', 'incomplete')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text,
  provider_subscription_id text,
  updated_at timestamptz not null default now(),
  check (plan_code <> 'free'),
  check (period_end > period_start),
  check ((provider_subscription_id is null) or (provider is not null)),
  unique (provider, provider_subscription_id)
);

-- Uso diario (00:00 America/Sao_Paulo), com bloqueio de linha por usuario/dia.
create table public.saas_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- Desbloqueio vitalicio da MESMA empresa por usuario: reencontrar a empresa nao gasta nova cota.
-- A interface nao deve confundir "lead desbloqueado" com "lead salvo manualmente".
create table public.saas_lead_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null check (length(place_id) between 4 and 255),
  unlocked_on date not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index saas_lead_unlocks_recent_idx
  on public.saas_lead_unlocks(user_id, unlocked_at desc);

-- Preparacao para deduplicar webhooks; NAO existe checkout ou webhook ativo nesta fase.
create table public.saas_billing_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  primary key (provider, event_id)
);

alter table public.saas_plans enable row level security;
alter table public.saas_plan_features enable row level security;
alter table public.saas_subscriptions enable row level security;
alter table public.saas_daily_usage enable row level security;
alter table public.saas_lead_unlocks enable row level security;
alter table public.saas_billing_events enable row level security;

revoke all on public.saas_plans, public.saas_plan_features,
  public.saas_subscriptions, public.saas_daily_usage,
  public.saas_lead_unlocks, public.saas_billing_events
  from public, anon, authenticated;

grant select on public.saas_plans, public.saas_plan_features to anon, authenticated;
grant select on public.saas_subscriptions, public.saas_daily_usage,
  public.saas_lead_unlocks to authenticated;
grant all on public.saas_plans, public.saas_plan_features, public.saas_subscriptions,
  public.saas_daily_usage, public.saas_lead_unlocks, public.saas_billing_events
  to service_role;

create policy saas_plans_public_read on public.saas_plans
  for select to anon, authenticated using (active = true);
create policy saas_plan_features_public_read on public.saas_plan_features
  for select to anon, authenticated using (
    exists (select 1 from public.saas_plans p
      where p.code = plan_code and p.active = true)
  );
create policy saas_subscriptions_own_read on public.saas_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy saas_daily_usage_own_read on public.saas_daily_usage
  for select to authenticated using ((select auth.uid()) = user_id);
create policy saas_lead_unlocks_own_read on public.saas_lead_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);
-- saas_billing_events: deliberadamente sem policy para clientes.

-- RPC de leitura do usuario autenticado. SECURITY INVOKER respeita RLS.
create function public.get_my_saas_entitlements()
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan text := 'free';
  v_price integer;
  v_limit integer;
  v_used integer := 0;
  v_features jsonb := '{}'::jsonb;
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then
    return null;
  end if;

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active = true
  where s.user_id = v_user
    and s.status = 'active'
    and s.period_end > now();
  v_plan := coalesce(v_plan, 'free');

  select p.price_cents, p.daily_lead_limit into v_price, v_limit
  from public.saas_plans p where p.code = v_plan;
  select coalesce(u.used, 0) into v_used
  from public.saas_daily_usage u
  where u.user_id = v_user and u.usage_date = v_day;
  v_used := coalesce(v_used, 0);

  select coalesce(jsonb_object_agg(f.feature_key, f.enabled), '{}'::jsonb)
  into v_features
  from public.saas_plan_features f
  where f.plan_code = v_plan;

  return jsonb_build_object(
    'plan', v_plan, 'price_cents', v_price, 'currency', 'BRL',
    'daily_limit', v_limit, 'used_today', v_used,
    'remaining_today', greatest(v_limit - v_used, 0),
    'usage_date', v_day, 'features', v_features
  );
end;
$$;
revoke all on function public.get_my_saas_entitlements() from public, anon, authenticated;
grant execute on function public.get_my_saas_entitlements() to authenticated, service_role;

-- Chamada APENAS pelo backend confiavel (service_role) APOS validar o JWT e acesso.
-- O cliente nunca envia user_id diretamente para esta RPC.
-- O retorno so inclui os IDs liberados; a Edge Function precisa filtrar a resposta
-- do Google Places antes de devolver qualquer dado nao desbloqueado.
create function public.claim_daily_leads_for_user(p_user_id uuid, p_place_ids text[])
returns jsonb
language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_plan text := 'free';
  v_limit integer;
  v_used integer;
  v_id text;
  v_seen text[] := array[]::text[];
  v_allowed text[] := array[]::text[];
  v_inserted integer;
  v_new integer := 0;
begin
  if p_user_id is null or p_place_ids is null or cardinality(p_place_ids) > 100 then
    raise exception 'Invalid lead quota request' using errcode = '22023';
  end if;

  select s.plan_code into v_plan
  from public.saas_subscriptions s
  join public.saas_plans p on p.code = s.plan_code and p.active = true
  where s.user_id = p_user_id
    and s.status = 'active' and s.period_end > now();
  v_plan := coalesce(v_plan, 'free');
  select p.daily_lead_limit into v_limit
  from public.saas_plans p where p.code = v_plan;

  insert into public.saas_daily_usage(user_id, usage_date, used)
  values (p_user_id, v_day, 0)
  on conflict (user_id, usage_date) do nothing;

  -- Uma unica transacao por usuario/dia contabiliza todas as paginas/buscas concorrentes.
  select u.used into v_used from public.saas_daily_usage u
  where u.user_id = p_user_id and u.usage_date = v_day
  for update;

  foreach v_id in array p_place_ids loop
    v_id := btrim(v_id);
    if v_id is null or length(v_id) < 4 or length(v_id) > 255
       or v_id = any(v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_id);

    if exists (
      select 1 from public.saas_lead_unlocks l
      where l.user_id = p_user_id and l.place_id = v_id
    ) then
      v_allowed := array_append(v_allowed, v_id);
    elsif v_used < v_limit then
      insert into public.saas_lead_unlocks (user_id, place_id, unlocked_on)
      values (p_user_id, v_id, v_day)
      on conflict (user_id, place_id) do nothing;
      get diagnostics v_inserted = row_count;
      if v_inserted = 1 then
        v_used := v_used + 1;
        v_new := v_new + 1;
        v_allowed := array_append(v_allowed, v_id);
      end if;
    end if;
  end loop;

  update public.saas_daily_usage
  set used = v_used, updated_at = now()
  where user_id = p_user_id and usage_date = v_day;

  return jsonb_build_object(
    'plan', v_plan, 'daily_limit', v_limit,
    'used_today', v_used, 'remaining_today', greatest(v_limit - v_used, 0),
    'newly_unlocked', v_new, 'allowed_place_ids', to_jsonb(v_allowed),
    'usage_date', v_day
  );
end;
$$;
revoke all on function public.claim_daily_leads_for_user(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.claim_daily_leads_for_user(uuid, text[])
  to service_role;
