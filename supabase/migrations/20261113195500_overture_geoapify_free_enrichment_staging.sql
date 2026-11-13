-- JANUARIO LEADS / STAGING ONLY
-- Geoapify Free-plan candidate research; NO Google Places, cron or mass jobs.
-- Separate from the Overture import and production CRM; never overwrites imported data.
create table if not exists public.overture_geoapify_enrichment (
  overture_id text primary key references public.overture_places(id) on delete cascade,
  status text not null check(status in ('matched','no_match','error')),
  candidate_name text,
  candidate_address text,
  candidate_phone text,
  candidate_email text,
  candidate_website text,
  candidate_instagram text,
  geoapify_place_id text,
  geoapify_categories text[],
  matched_distance_m integer,
  matched_name_similarity real,
  source text not null default 'geoapify_places' check(source='geoapify_places'),
  reviewed boolean not null default false,
  checked_at timestamptz not null default now(),
  note text,
  constraint geoapify_candidate_matched_has_identity check (
    status <> 'matched' or (candidate_name is not null and geoapify_place_id is not null)
  )
);

create table if not exists public.overture_geoapify_free_credit_usage (
  utc_day date primary key,
  credits_reserved integer not null default 0 check(credits_reserved between 0 and 250),
  checked_at timestamptz not null default now()
);

alter table public.overture_geoapify_enrichment enable row level security;
alter table public.overture_geoapify_free_credit_usage enable row level security;
revoke all on public.overture_geoapify_enrichment from public,anon,authenticated;
revoke all on public.overture_geoapify_free_credit_usage from public,anon,authenticated;
grant select,insert,update on public.overture_geoapify_enrichment to service_role;
grant select,insert,update on public.overture_geoapify_free_credit_usage to service_role;

create or replace function public.claim_overture_geoapify_free_credit(p_daily_limit integer default 250)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_used integer;
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 250 then
    return false;
  end if;
  -- Reserve quota BEFORE dispatch, including unsuccessful provider calls.
  insert into public.overture_geoapify_free_credit_usage(utc_day,credits_reserved)
  values ((now() at time zone 'UTC')::date,1)
  on conflict(utc_day) do update
    set credits_reserved=public.overture_geoapify_free_credit_usage.credits_reserved+1,
        checked_at=now()
    where public.overture_geoapify_free_credit_usage.credits_reserved<p_daily_limit
  returning credits_reserved into v_used;
  return v_used is not null;
end;
$$;
revoke all on function public.claim_overture_geoapify_free_credit(integer) from public,anon,authenticated;
grant execute on function public.claim_overture_geoapify_free_credit(integer) to service_role;

-- Return business names and positions only for businesses not yet attempted.
-- p_mode allows staged coverage without pretending that a free trial covers all Brazil.
create or replace function public.next_overture_geoapify_targets(
    p_mode text default 'no_contact', p_limit integer default 25
)
returns table (
  id text,name text,category text,city text,state text,
  latitude double precision,longitude double precision,
  address text,phone text,email text,website text,instagram text
)
language sql security invoker set search_path='' as $$
  select p.id,p.name,p.category,p.city,p.state,
    p.latitude,p.longitude,p.address,p.phone,p.email,p.website,p.instagram
  from public.overture_places p
  where p_mode in ('no_contact','any_missing','all')
    and not exists(select 1 from public.overture_geoapify_enrichment e
                   where e.overture_id=p.id)
    and (
      p_mode='all'
      or (p_mode='no_contact'
        and nullif(btrim(p.phone),'') is null
        and nullif(btrim(p.email),'') is null
        and nullif(btrim(p.website),'') is null)
      or (p_mode='any_missing' and (
        nullif(btrim(p.phone),'') is null
        or nullif(btrim(p.email),'') is null
        or nullif(btrim(p.website),'') is null
        or nullif(btrim(p.instagram),'') is null
      ))
    )
    and p.name is not null
    and p.latitude between -34 and 6
    and p.longitude between -74 and -30
  order by p.id
  limit least(greatest(coalesce(p_limit,25),1),50);
$$;
revoke all on function public.next_overture_geoapify_targets(text,integer) from public,anon,authenticated;
grant execute on function public.next_overture_geoapify_targets(text,integer) to service_role;

comment on table public.overture_geoapify_enrichment is 'Staging-only, provider-attributed suggestions; not propagated to production or Overture until reviewed.';
comment on table public.overture_geoapify_free_credit_usage is 'Hard cap 250 Geoapify Places requests per UTC day for Phase 8 notebook; not an account-wide billing guarantee.';
