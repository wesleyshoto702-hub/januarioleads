-- Januário Leads — estrutura Overture privada (PRODUÇÃO).
-- Aplicada no projeto czkazbianiflhldenhcj pelo Supabase em 25/11/2026
-- como migration 20261125123659_create_private_overture_places_for_backend_search.
-- Esta migration NÃO importa estabelecimentos, não altera CRM/Auth/Storage
-- e não habilita Geoapify, Google Places ou chamadas pagas.
create table if not exists public.overture_places (
  id text primary key,
  name text not null,
  name_key text,
  category text,
  city text not null,
  city_key text not null,
  state varchar(2) not null,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  website text,
  instagram text,
  confidence double precision,
  operating_status text,
  data_release text,
  imported_at timestamptz not null default now(),
  constraint overture_places_state_format check (state ~ '^[A-Z]{2}$'),
  constraint overture_places_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint overture_places_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint overture_places_confidence_range check (confidence is null or confidence between 0 and 1)
);

alter table public.overture_places enable row level security;
revoke all on table public.overture_places from public, anon, authenticated;
grant select, insert, update, delete on table public.overture_places to service_role;

create index if not exists overture_places_search_idx
  on public.overture_places (state, city_key, category, id);

comment on table public.overture_places is
  'Catálogo privado de estabelecimentos Overture. Uso exclusivo do backend com service_role; sem acesso direto anon/authenticated. Criação da estrutura não importa registros.';
