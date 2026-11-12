-- Outscraper Instagram candidates: tightly capped, domain-deduplicated.
-- Store only a business domain, request ID and public Instagram profile URLs.
-- NO private personal contacts, emails or API secrets are persisted.
create table if not exists public.outscraper_instagram_jobs (
  domain text primary key check (length(domain) between 4 and 253),
  status text not null default 'starting'
    check (status in ('starting', 'pending', 'complete', 'failed')),
  request_id text,
  instagram_candidates jsonb not null default '[]'::jsonb
    check (jsonb_typeof(instagram_candidates) = 'array'),
  created_at timestamptz not null default now(),
  checked_at timestamptz not null default now()
);
alter table public.outscraper_instagram_jobs enable row level security;
revoke all on table public.outscraper_instagram_jobs from public, anon, authenticated;
grant select, insert, update on table public.outscraper_instagram_jobs to service_role;

-- Serializes all first-time submissions, preventing concurrent users from
-- accidentally exceeding the externally authorized domain quota.
create or replace function public.claim_outscraper_instagram_domain(
  p_domain text,
  p_daily_limit integer,
  p_rolling_30day_limit integer
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_daily integer;
  v_period integer;
begin
  if p_domain is null
      or length(p_domain) not between 4 and 253
      or p_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    return 'invalid';
  end if;
  -- Lock serializes budget counting & insertion, incl. across parallel users.
  perform pg_catalog.pg_advisory_xact_lock(394511, 22564);

  if exists (select 1 from public.outscraper_instagram_jobs
             where domain = p_domain) then
    return 'existing';
  end if;

  -- Default zero is a HARD OFF switch. Even an API key cannot charge until
  -- the operator explicitly sets both budgets in the Edge Function secrets.
  if p_daily_limit is null or p_rolling_30day_limit is null
     or p_daily_limit < 1 or p_rolling_30day_limit < 1
     or p_daily_limit > 10 or p_rolling_30day_limit > 200 then
    return 'disabled';
  end if;

  select count(*) into v_daily
  from public.outscraper_instagram_jobs
  where created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  select count(*) into v_period
  from public.outscraper_instagram_jobs
  where created_at >= now() - interval '30 days';

  if v_daily >= p_daily_limit or v_period >= p_rolling_30day_limit then
    return 'quota';
  end if;

  insert into public.outscraper_instagram_jobs(domain, status)
  values (p_domain, 'starting');

  return 'reserved';
end;
$$;
revoke all on function public.claim_outscraper_instagram_domain(text,integer,integer)
  from public, anon, authenticated;
grant execute on function public.claim_outscraper_instagram_domain(text,integer,integer)
  to service_role;
