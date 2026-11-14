-- Fase 9 V5 / Januário Leads: STAGING ONLY. Never apply to production.
-- Checkpoints are private; no browser access; existing Overture leads are immutable.
create table if not exists public.overture_phase9_v5_attempts (
  state varchar(2) not null,
  city_key text not null,
  city text not null,
  population integer,
  tier text not null default 'unknown' check (tier in ('small','medium','large','metro','unknown')),
  target_count integer not null check (target_count between 1 and 3500),
  first_count integer not null default 0 check (first_count >= 0),
  after_count integer not null default 0 check (after_count >= 0),
  added_count integer not null default 0 check (added_count >= 0),
  result text not null default 'pending' check (result in ('pending','gained','partial','no_more','error','complete')),
  error_code text check (error_code is null or length(error_code) <= 80),
  retry_after timestamptz,
  attempted_at timestamptz not null default now(),
  primary key(state,city_key)
);
alter table public.overture_phase9_v5_attempts enable row level security;
revoke all on public.overture_phase9_v5_attempts from public,anon,authenticated;
grant select,insert,update on public.overture_phase9_v5_attempts to service_role;
comment on table public.overture_phase9_v5_attempts is
'STAGING ONLY: resumable balanced Overture Phase 9 V5 checkpoints; secrets never stored.';
create or replace view public.overture_phase9_v5_gaps
with (security_invoker = true) as
select
  state,city_key,max(city) as city,count(*)::integer as imported_rows,
  count(*) filter(where category='barber')::integer as barbers,
  count(*) filter(where category in ('restaurant','brazilian_restaurant','pizza_restaurant','burger_restaurant','barbecue_restaurant','steakhouse'))::integer as food,
  count(*) filter(where category in ('gym','fitness_center','pilates_studio'))::integer as fitness,
  count(*) filter(where category in ('beauty_salon','hair_salon','nail_salon'))::integer as beauty,
  count(*) filter(where category in ('dental_clinic','general_dentistry','doctors_office','pharmacy'))::integer as health,
  count(*) filter(where category in ('automotive_repair','car_wash','auto_detailing','auto_dealer','motorcycle_repair'))::integer as auto_services,
  count(*) filter(where category in ('hotel','inn','guest_house','bed_and_breakfast'))::integer as lodging,
  count(*) filter(where category in ('building_supply_store','hardware_store','furniture_store','clothing_store','shoe_store'))::integer as retail,
  count(*) filter(where phone is not null and length(regexp_replace(phone,'[^0-9]','','g')) between 10 and 13)::integer as with_phone,
  count(*) filter(where email is not null and email like '%@%')::integer as with_email,
  count(*) filter(where website is not null and website ~* '^https?://')::integer as with_website
from public.overture_places
group by state,city_key;
revoke all on public.overture_phase9_v5_gaps from public,anon,authenticated;
grant select on public.overture_phase9_v5_gaps to service_role;
comment on view public.overture_phase9_v5_gaps is
'STAGING only: group coverage and verified contact signals to prioritize niche gaps.';
