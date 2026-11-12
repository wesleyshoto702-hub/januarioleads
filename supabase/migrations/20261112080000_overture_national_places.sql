-- National Overture Places ingestion. Only the backend/service role can access the dataset.
-- The ingestion runner checks total database size before each batch.
create table if not exists public.overture_places (
  id text primary key,
  name text not null,
  name_key text not null,
  category text,
  city text not null,
  city_key text not null,
  state varchar(2) not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  email text,
  website text,
  instagram text,
  confidence real,
  operating_status text,
  data_release text not null default 'latest',
  updated_at timestamptz not null default now(),
  constraint overture_id_length check (char_length(id) between 10 and 100),
  constraint overture_name_length check (char_length(name) between 1 and 240),
  constraint overture_state_code check (state ~ '^[A-Z]{2}$'),
  constraint overture_latitude check (latitude between -34 and 6),
  constraint overture_longitude check (longitude between -75 and -28)
);
create index if not exists overture_places_city_category_idx
  on public.overture_places (state, city_key, category);
create index if not exists overture_places_city_name_idx
  on public.overture_places (state, city_key, name_key);
alter table public.overture_places enable row level security;
revoke all on table public.overture_places from public, anon, authenticated;
grant select, insert, update, delete on table public.overture_places to service_role;

create table if not exists public.overture_import_progress (
  state varchar(2) primary key,
  status text not null check (status in ('pending','running','partial','complete','error')),
  imported_rows integer not null default 0,
  last_error text,
  checked_at timestamptz not null default now()
);
alter table public.overture_import_progress enable row level security;
revoke all on table public.overture_import_progress from public, anon, authenticated;
grant select, insert, update on table public.overture_import_progress to service_role;

-- Restricted to service_role; prevents unnoticed free database-tier exhaustion.
create or replace function public.overture_storage_bytes()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_database_size(current_database())::bigint;
$$;
revoke all on function public.overture_storage_bytes() from public, anon, authenticated;
grant execute on function public.overture_storage_bytes() to service_role;
