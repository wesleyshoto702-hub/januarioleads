-- Indexes para as FKs de assinaturas e eventos.
-- Aplicar depois de 20261107220700_saas_plans_and_daily_lead_quotas.sql.
create index saas_subscriptions_plan_code_idx
  on public.saas_subscriptions(plan_code);
create index saas_billing_events_user_id_idx
  on public.saas_billing_events(user_id)
  where user_id is not null;
