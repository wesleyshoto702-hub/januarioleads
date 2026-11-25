create table public.search_provider_budget_limits (
 provider text not null check(provider in ('geoapify','google_places')),
 operation text not null,
 enabled boolean not null default false,
 daily_project int not null check(daily_project between 1 and 300),
 monthly_project int not null check(monthly_project between 1 and 3000),
 daily_user int not null check(daily_user between 1 and daily_project),
 primary key(provider,operation)
);
create table public.search_provider_budget_usage (
 provider text not null, operation text not null, scope text not null,
 request_count int not null default 0 check(request_count>=0),
 primary key(provider,operation,scope),
 foreign key(provider,operation) references public.search_provider_budget_limits(provider,operation)
);
alter table public.search_provider_budget_limits enable row level security;
alter table public.search_provider_budget_usage enable row level security;
revoke all on public.search_provider_budget_limits,public.search_provider_budget_usage from public,anon,authenticated;
grant select on public.search_provider_budget_limits to service_role;
grant select,insert,update on public.search_provider_budget_usage to service_role;
insert into public.search_provider_budget_limits values
('geoapify','geocode',true,50,1000,5),
('geoapify','places',true,50,1000,5),
('google_places','text_search_enterprise',true,5,100,5),
('google_places','place_details_enterprise',true,5,100,5);
create function public.claim_search_provider_budget(p_provider text,p_user_id uuid,p_operation text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare cfg public.search_provider_budget_limits%rowtype;
d text := 'day:'||(now() at time zone 'America/Sao_Paulo')::date::text;
m text := 'month:'||date_trunc('month',now() at time zone 'America/Sao_Paulo')::date::text;
u text := 'user:'||p_user_id::text||':'||d;
begin
 if p_user_id is null or not exists(select 1 from public.private_access where user_id=p_user_id) then return false; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_provider),pg_catalog.hashtext(p_operation));
 select * into cfg from public.search_provider_budget_limits where provider=p_provider and operation=p_operation and enabled;
 if not found then return false; end if;
 if exists(select 1 from public.search_provider_budget_usage where provider=p_provider and operation=p_operation and ((scope=d and request_count>=cfg.daily_project) or (scope=m and request_count>=cfg.monthly_project) or (scope=u and request_count>=cfg.daily_user))) then return false; end if;
 insert into public.search_provider_budget_usage(provider,operation,scope,request_count) values(p_provider,p_operation,d,1),(p_provider,p_operation,m,1),(p_provider,p_operation,u,1)
 on conflict(provider,operation,scope) do update set request_count=public.search_provider_budget_usage.request_count+1;
 return true;
end; $$;
revoke all on function public.claim_search_provider_budget(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_search_provider_budget(text,uuid,text) to service_role;
create function public.claim_saas_geoapify_api_budget(p_user_id uuid,p_operation text) returns boolean language sql security invoker set search_path='' as $$ select public.claim_search_provider_budget('geoapify',p_user_id,p_operation); $$;
create function public.claim_saas_google_api_budget(p_user_id uuid,p_operation text) returns boolean language sql security invoker set search_path='' as $$ select public.claim_search_provider_budget('google_places',p_user_id,p_operation); $$;
revoke all on function public.claim_saas_geoapify_api_budget(uuid,text),public.claim_saas_google_api_budget(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_saas_geoapify_api_budget(uuid,text),public.claim_saas_google_api_budget(uuid,text) to service_role;