-- Read-only pilot: run ONLY in Januario Leads STAGING.
-- No API/provider calls, writes, credentials or billable enrichment.
-- Values correspond to the canonical niche categories currently in repo.
WITH scenarios(state, city_key, niche, categories) AS (
  VALUES
  ('MG','lavras','Barbearia',ARRAY['barber']),
  ('MG','varginha','Clínica Odontológica',ARRAY['dental_clinic','dentist','general_dentistry']),
  ('SP','sao paulo','Academia',ARRAY['gym','fitness_center']),
  ('SP','campinas','Barbearia',ARRAY['barber']),
  ('RJ','rio de janeiro','Restaurante',ARRAY['restaurant','brazilian_restaurant','barbecue_restaurant','steakhouse']),
  ('DF','brasilia','Clínica Odontológica',ARRAY['dental_clinic','dentist','general_dentistry']),
  ('PR','curitiba','Hotel',ARRAY['hotel','inn','hostel']),
  ('BA','salvador','Salão de Beleza',ARRAY['beauty_salon','hair_salon']),
  ('CE','fortaleza','Farmácia',ARRAY['pharmacy']),
  ('AM','manaus','Mercado',ARRAY['grocery_store']),
  ('RS','porto alegre','Estética Automotiva',ARRAY['car_wash','auto_detailing']),
  ('SP','campinas','Padaria',ARRAY['bakery'])
)
SELECT s.state, s.city_key, s.niche,
  COUNT(p.id)::int AS matching_rows,
  COUNT(p.id) FILTER(WHERE nullif(btrim(p.phone),'') IS NOT NULL)::int AS with_phone,
  COUNT(p.id) FILTER(WHERE nullif(btrim(p.website),'') IS NULL)::int AS site_unidentified,
  COUNT(p.id) FILTER(WHERE p.operating_status='permanently_closed')::int AS permanently_closed,
  COUNT(DISTINCT lower(trim(p.name)) || '|' || coalesce(lower(trim(p.address)),''))::int
    AS approximate_unique_names_and_addresses
FROM scenarios s
LEFT JOIN public.overture_places p ON p.state=s.state
  AND p.city_key=s.city_key AND p.category=ANY(s.categories)
GROUP BY s.state,s.city_key,s.niche
ORDER BY s.state,s.city_key,s.niche;
