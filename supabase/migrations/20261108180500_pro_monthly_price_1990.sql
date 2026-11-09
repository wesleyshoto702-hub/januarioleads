-- Januario Leads — change Pro monthly list price from BRL 14.90 to BRL 19.90.
-- Schema exists in staging only. Keep Free/Advanced, features, subscriptions,
-- daily limits and billing-provider integration untouched.
-- Applied after 20261107220700_saas_plans_and_daily_lead_quotas.sql.
do $$
begin
  if to_regclass('public.saas_plans') is null then
    raise exception 'saas_plans must exist before applying the Pro price update';
  end if;

  update public.saas_plans
    set price_cents = 1990
    where code = 'pro' and price_cents = 1490;

  if not exists (
    select 1 from public.saas_plans where code = 'pro' and price_cents = 1990
  ) then
    raise exception 'Pro price must be 1990 BRL cents; investigate the current value';
  end if;
end $$;
