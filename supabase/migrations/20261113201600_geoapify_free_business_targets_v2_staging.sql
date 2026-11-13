-- JANUARIO LEADS / STAGING ONLY — controlled Phase 8 commercial selection v2.
-- No changes to Overture or production search; retry is explicitly opt-in.
create or replace function public.next_overture_geoapify_business_targets(
  p_mode text default 'no_contact',
  p_limit integer default 25,
  p_retry_no_match boolean default false
)
returns table (
  id text, name text, category text, city text, state text,
  latitude double precision, longitude double precision,
  address text, phone text, email text, website text, instagram text
)
language sql security invoker set search_path = ''
as $$
  with eligible as (
    select p.id, p.name, p.category, p.city, p.state,
           p.latitude, p.longitude, p.address, p.phone, p.email, p.website, p.instagram,
           row_number() over (
             partition by p.category
             order by case when p.address ~ '[0-9]' then 0 else 1 end, md5(p.id)
           ) as category_slot
    from public.overture_places p
    where p_mode in ('no_contact','any_missing','all')
      and p.category = any (array[
        'grocery_store','hotel','clothing_store','beauty_salon','pharmacy',
        'dental_clinic','restaurant','gas_station','bar','shopping','gym',
        'professional_service','barber','furniture_store','automotive_repair',
        'pizza_restaurant','bakery','building_supply_store','ice_cream_shop',
        'real_estate_service','womens_clothing_store','convenience_store',
        'shoe_store','electronics_store','hardware_store','cafe','coffee_shop',
        'pet_store','car_dealer','car_wash','supermarket','hair_salon',
        'medical_clinic','attorney_or_law_firm','optician','florist',
        'travel_agency','accountant','veterinarian','laundry','dry_cleaner'
      ])
      and p.name is not null and length(btrim(p.name)) >= 4
      and p.latitude between -34 and 6
      and p.longitude between -74 and -30
      and (
        p_mode='all'
        or (p_mode='no_contact' and nullif(btrim(p.phone),'') is null
            and nullif(btrim(p.email),'') is null
            and nullif(btrim(p.website),'') is null)
        or (p_mode='any_missing' and (
            nullif(btrim(p.phone),'') is null or nullif(btrim(p.email),'') is null
            or nullif(btrim(p.website),'') is null or nullif(btrim(p.instagram),'') is null
        ))
      )
      and (
        (not p_retry_no_match and not exists (
          select 1 from public.overture_geoapify_enrichment e where e.overture_id=p.id
        ))
        or (p_retry_no_match and exists (
          select 1 from public.overture_geoapify_enrichment e
          where e.overture_id=p.id and e.status='no_match' and e.reviewed=false
        ))
      )
  )
  select e.id,e.name,e.category,e.city,e.state,e.latitude,e.longitude,
         e.address,e.phone,e.email,e.website,e.instagram
  from eligible e
  order by e.category_slot, md5(e.category), md5(e.id)
  limit least(greatest(coalesce(p_limit,25),1),25);
$$;
revoke all on function public.next_overture_geoapify_business_targets(text,integer,boolean) from public,anon,authenticated;
grant execute on function public.next_overture_geoapify_business_targets(text,integer,boolean) to service_role;
comment on function public.next_overture_geoapify_business_targets(text,integer,boolean) is
  'Staging-only commercial Phase 8 sampling. No provider calls. Retry of unreviewed no_match records is opt-in.';
