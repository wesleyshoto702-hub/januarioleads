-- Fase 1.1: piloto de 18 buscas reais. SOMENTE LEITURA na homologação.
-- 15/11/2026; categorias verificadas em _shared/overture-search.ts na main.
-- A contagem indica registros do banco por categoria, NÃO validação de telefone
-- ou relevância editorial por estabelecimento.
WITH cases(state,city_key,niche,categories) AS (
 VALUES
 ('MG','lavras','Barbearia',ARRAY['barber']),
 ('MG','lavras','Academia',ARRAY['gym','fitness_center']),
 ('MG','varginha','Clínica Odontológica',ARRAY['dental_clinic','dentist','general_dentistry']),
 ('SP','sao paulo','Academia',ARRAY['gym','fitness_center']),
 ('SP','campinas','Barbearia',ARRAY['barber']),
 ('SP','campinas','Padaria',ARRAY['bakery']),
 ('RJ','rio de janeiro','Restaurante',ARRAY['restaurant','brazilian_restaurant','barbecue_restaurant','steakhouse']),
 ('DF','brasilia','Clínica Odontológica',ARRAY['dental_clinic','dentist','general_dentistry']),
 ('PR','curitiba','Hotel',ARRAY['hotel']),
 ('BA','salvador','Salão de Beleza',ARRAY['beauty_salon','hair_salon']),
 ('CE','fortaleza','Farmácia',ARRAY['pharmacy']),
 ('AM','manaus','Mercado / Supermercado',ARRAY['grocery_store']),
 ('RS','porto alegre','Mecânica Automotiva',ARRAY['automotive_repair','auto_repair']),
 ('SC','florianopolis','Pet Shop',ARRAY['pet_store']),
 ('GO','goiania','Pizzaria',ARRAY['pizza_restaurant']),
 ('PE','recife','Imobiliária',ARRAY['real_estate_agency','real_estate_service','real_estate_agent']),
 ('ES','vitoria','Loja de Roupas',ARRAY['clothing_store','womens_clothing_store','mens_clothing_store','fashion_boutique']),
 ('MT','cuiaba','Loja de Veículos Seminovos',ARRAY['car_dealer','used_car_dealer','auto_dealer'])
)
SELECT c.state,c.city_key,c.niche,
count(p.id)::int AS raw_matches,
count(p.id) FILTER (WHERE p.operating_status IS DISTINCT FROM 'permanently_closed')::int AS non_closed,
count(p.id) FILTER (WHERE p.phone IS NOT NULL AND length(regexp_replace(p.phone,'[^0-9]','','g')) BETWEEN 10 AND 13)::int AS plausible_phone_digits,
count(p.id) FILTER (WHERE nullif(btrim(p.website),'') IS NULL)::int AS site_not_recorded,
count(p.id) FILTER (WHERE nullif(btrim(p.instagram),'') IS NOT NULL)::int AS instagram_recorded,
count(p.id) FILTER (WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL)::int AS with_coordinates,
count(p.id) FILTER (WHERE nullif(btrim(p.address),'') IS NULL)::int AS missing_address
FROM cases c LEFT JOIN public.overture_places p
ON p.state=c.state AND p.city_key=c.city_key AND p.category=ANY(c.categories)
GROUP BY c.state,c.city_key,c.niche ORDER BY c.state,c.city_key,c.niche;
