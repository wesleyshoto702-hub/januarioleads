-- FASE 1.5a — OVERTURE STAGING, SOMENTE LEITURA (15/11/2026)
-- Projeto autorizado: prlrxjothrslhswpkoza. NUNCA em produção.
-- Somente SELECT/CTEs; sem serviço externo, parâmetros secretos, DML ou PII
-- nas SAÍDAS. Métricas de estrutura NÃO comprovam titularidade/validade.
-- Limite de 15m é indicativo (mesmo nome normalizado/UF/cidade): proximidade
-- não autoriza apagar nem fundir registros. Endereço normalizado por expressão
-- SQL aproximada (não idêntica à função JS que também remove acentos).
--
-- Q1: integridade de IDs e grupos por nome.
WITH names AS (
 SELECT state,city_key,name_key,
 count(*)::int n,
 count(DISTINCT lower(btrim(address)))::int addresses,
 count(DISTINCT category)::int categories,
 count(DISTINCT concat(round(latitude::numeric,5),':',round(longitude::numeric,5)))::int approx_coords
 FROM public.overture_places WHERE NULLIF(btrim(name_key),'') IS NOT NULL
 GROUP BY 1,2,3 HAVING count(*)>1
)
SELECT
 (SELECT count(*)::int FROM public.overture_places) AS total,
 (SELECT count(DISTINCT id)::int FROM public.overture_places) AS distinct_ids,
 (SELECT count(*)::int FROM public.overture_places WHERE NULLIF(btrim(name_key),'') IS NULL) AS missing_name_key,
 count(*)::int AS repeated_name_city_groups,
 coalesce(sum(n),0)::int AS rows_in_these_groups,
 coalesce(sum(n-1),0)::int AS excessive_merges_if_name_only,
 count(*) FILTER(WHERE approx_coords>1)::int AS groups_with_different_rounded_coords,
 count(*) FILTER(WHERE addresses>1)::int AS groups_with_distinct_known_addresses,
 count(*) FILTER(WHERE categories>1)::int AS groups_with_distinct_categories
FROM names;

-- Q2: pares por nome/UF/cidade, dentro da caixa angular ±0,002°,
-- distância de Haversine; cuidado com categorias, endereços e telefones.
WITH repeated_names AS (
 SELECT state,city_key,name_key FROM public.overture_places
 WHERE NULLIF(btrim(name_key),'') IS NOT NULL
 GROUP BY 1,2,3 HAVING count(*)>1
), near_pairs AS (
 SELECT a.state,a.city_key,a.name_key,
 a.category AS category_a,b.category AS category_b,
 lower(trim(regexp_replace(btrim(coalesce(a.address,'')),'[^[:alnum:]]+',' ','g'))) AS address_a,
 lower(trim(regexp_replace(btrim(coalesce(b.address,'')),'[^[:alnum:]]+',' ','g'))) AS address_b,
 regexp_replace(coalesce(a.phone,''),'[^0-9]','','g') AS phone_a,
 regexp_replace(coalesce(b.phone,''),'[^0-9]','','g') AS phone_b,
 2*6371000*asin(least(1,sqrt(
   power(sin(radians((a.latitude-b.latitude)/2)),2) +
   cos(radians(a.latitude))*cos(radians(b.latitude)) *
   power(sin(radians((a.longitude-b.longitude)/2)),2)
  ))) AS distance_m
 FROM repeated_names g
 JOIN public.overture_places a ON a.state=g.state AND a.city_key=g.city_key AND a.name_key=g.name_key
 JOIN public.overture_places b ON b.state=a.state AND b.city_key=a.city_key AND b.name_key=a.name_key AND a.id<b.id
 WHERE abs(a.latitude-b.latitude)<0.002 AND abs(a.longitude-b.longitude)<0.002
), flags AS (
 SELECT *,
  category_a IS NOT NULL AND category_b IS NOT NULL AND category_a<>category_b AS category_conflict,
  address_a<>'' AND address_b<>'' AND address_a<>address_b AS address_conflict,
  phone_a<>'' AND phone_b<>'' AND phone_a<>phone_b AS phone_conflict
 FROM near_pairs WHERE distance_m<=15
)
SELECT count(*)::int AS name_nearby_pairs_15m,
 count(DISTINCT (state,city_key,name_key))::int AS name_city_groups_with_near_pairs,
 count(*) FILTER(WHERE address_conflict)::int AS address_conflicts,
 count(*) FILTER(WHERE category_conflict)::int AS category_conflicts,
 count(*) FILTER(WHERE phone_conflict)::int AS phone_conflicts,
 count(*) FILTER(WHERE address_conflict OR category_conflict OR phone_conflict)::int AS any_conflict,
 count(*) FILTER(WHERE NOT(address_conflict OR category_conflict OR phone_conflict))::int AS structurally_compatible_pairs
FROM flags;

-- Q3: compartilhamento de contatos; NÃO expor valores ou excluir automaticamente.
WITH phones AS (
 SELECT regexp_replace(phone,'[^0-9]','','g') contact,
 count(*)::int n,
 count(DISTINCT concat_ws('|',state,city_key))::int city_count,
 count(DISTINCT name_key)::int name_count
 FROM public.overture_places WHERE NULLIF(btrim(phone),'') IS NOT NULL GROUP BY 1
), emails AS (
 SELECT lower(btrim(email)) contact,
 count(*)::int n,
 count(DISTINCT concat_ws('|',state,city_key))::int city_count,
 count(DISTINCT name_key)::int name_count
 FROM public.overture_places WHERE NULLIF(btrim(email),'') IS NOT NULL GROUP BY 1
)
SELECT
 (SELECT count(*) FROM phones WHERE n>1) AS repeated_phone_groups,
 (SELECT coalesce(sum(n),0) FROM phones WHERE n>1) AS rows_with_shared_phone,
 (SELECT count(*) FROM phones WHERE n>=10) AS phone_groups_10plus,
 (SELECT coalesce(sum(n),0) FROM phones WHERE n>=10) AS rows_in_phone_10plus,
 (SELECT count(*) FROM phones WHERE n>=10 AND city_count>1) AS high_reuse_phones_multiple_cities,
 (SELECT max(n) FROM phones) AS highest_phone_reuse,
 (SELECT count(*) FROM emails WHERE n>1) AS repeated_email_groups,
 (SELECT coalesce(sum(n),0) FROM emails WHERE n>1) AS rows_with_shared_email,
 (SELECT count(*) FROM emails WHERE n>=10) AS email_groups_10plus,
 (SELECT coalesce(sum(n),0) FROM emails WHERE n>=10) AS rows_in_email_10plus,
 (SELECT count(*) FROM emails WHERE n>=10 AND city_count>1) AS high_reuse_emails_multiple_cities,
 (SELECT max(n) FROM emails) AS highest_email_reuse;

-- Q4: validação de FORMATO BÁSICO — NÃO verifica empresa, WhatsApp ou Instagram oficial.
WITH fields AS (
 SELECT
 regexp_replace(coalesce(phone,''),'[^0-9]','','g') digits,
 lower(btrim(coalesce(email,''))) mail,
 lower(btrim(coalesce(website,''))) web,
 lower(btrim(coalesce(instagram,''))) ig,
 phone,email,website,instagram
 FROM public.overture_places
)
SELECT count(*)::int AS total,
 count(*) FILTER(WHERE NULLIF(btrim(phone),'') IS NOT NULL)::int AS phone_present,
 count(*) FILTER(WHERE length(digits) IN(10,11) OR (length(digits) IN(12,13) AND left(digits,2)='55'))::int AS plausible_br_phone_length_prefix,
 count(*) FILTER(WHERE NULLIF(btrim(phone),'') IS NOT NULL AND NOT(length(digits) IN(10,11) OR (length(digits) IN(12,13) AND left(digits,2)='55')))::int AS phone_other_format,
 count(*) FILTER(WHERE digits ~ '^([0-9])\\1{9,12}$')::int AS repeated_digit_numbers,
 count(*) FILTER(WHERE NULLIF(btrim(email),'') IS NOT NULL)::int AS email_present,
 count(*) FILTER(WHERE mail<>'' AND mail !~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')::int AS email_invalid_basic,
 count(*) FILTER(WHERE NULLIF(btrim(website),'') IS NOT NULL)::int AS website_present,
 count(*) FILTER(WHERE web<>'' AND web !~ '^https?://[^[:space:]/]+\\.[^[:space:]/]+')::int AS website_invalid_http_format,
 count(*) FILTER(WHERE web ~ '^https?://(www\\.)?(instagram\\.com|facebook\\.com|wa\\.me|linktr\\.ee)(/|$)')::int AS website_points_to_social,
 count(*) FILTER(WHERE NULLIF(btrim(instagram),'') IS NOT NULL)::int AS instagram_present,
 count(*) FILTER(WHERE ig<>'' AND ig !~ '^https?://(www\\.)?instagram\\.com/')::int AS instagram_invalid_domain_format,
 count(*) FILTER(WHERE ig ~ '^https?://(www\\.)?instagram\\.com/(p|reel|reels|tv|explore|stories)/')::int AS instagram_content_not_profiles,
 count(*) FILTER(WHERE ig ~ '^https?://(www\\.)?instagram\\.com/?(\\?.*)?$')::int AS instagram_homepage,
 count(*) FILTER(WHERE ig ~ '^https?://(www\\.)?instagram\\.com/[^/?#]+(/)?(\\?.*)?$')::int AS instagram_single_path_segment
FROM fields;
