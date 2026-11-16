-- Colab V1 | Preparar candidatos Overture para análise Geoapify (SOMENTE LEITURA)
-- NÃO execute antes de concluir Fase 0 (revogação service_role + backup/restauração).
-- AMBIENTE: STAGING prlrxjothrslhswpkoza. Nunca produção.
-- Rode a consulta em uma sessão autorizada, exporte o resultado como CSV:
-- overture_places_candidatos.csv
-- NÃO contém credenciais, scripts de escrita ou chamadas a provedores.
-- Prioriza dados empresariais incompletos, sem confundir ausência com inexistência.
WITH candidatos AS (
  SELECT
    p.id, p.name, p.category, p.city, p.state, p.city_key,
    p.address, p.latitude, p.longitude,
    p.phone, p.email, p.website, p.instagram, p.operating_status,
    (
      CASE WHEN NULLIF(BTRIM(p.phone),'') IS NULL THEN 5 ELSE 0 END +
      CASE WHEN NULLIF(BTRIM(p.email),'') IS NULL THEN 4 ELSE 0 END +
      CASE WHEN NULLIF(BTRIM(p.website),'') IS NULL THEN 3 ELSE 0 END +
      CASE WHEN NULLIF(BTRIM(p.instagram),'') IS NULL THEN 2 ELSE 0 END +
      CASE WHEN NULLIF(BTRIM(p.address),'') IS NULL THEN 1 ELSE 0 END
    ) AS missing_priority
  FROM public.overture_places p
  WHERE NULLIF(BTRIM(p.id),'') IS NOT NULL
    AND NULLIF(BTRIM(p.name),'') IS NOT NULL
    AND NULLIF(BTRIM(p.category),'') IS NOT NULL
    AND NULLIF(BTRIM(p.city),'') IS NOT NULL
    AND p.state IS NOT NULL
    AND p.latitude BETWEEN -34 AND 6
    AND p.longitude BETWEEN -75 AND -28
    AND p.operating_status IS DISTINCT FROM 'permanently_closed'
    AND (
      NULLIF(BTRIM(p.phone),'') IS NULL OR
      NULLIF(BTRIM(p.email),'') IS NULL OR
      NULLIF(BTRIM(p.website),'') IS NULL OR
      NULLIF(BTRIM(p.instagram),'') IS NULL OR
      NULLIF(BTRIM(p.address),'') IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.overture_geoapify_enrichment t
      WHERE t.overture_id = p.id
    )
),
distribuidos AS (
  SELECT c.*, ROW_NUMBER() OVER (
    PARTITION BY c.state
    ORDER BY c.missing_priority DESC, c.city_key ASC, c.id ASC
  ) AS rank_uf
  FROM candidatos c
)
SELECT id, name, category, city, state, address, latitude, longitude,
       phone, email, website, instagram, operating_status
FROM distribuidos
WHERE rank_uf <= 180
ORDER BY state, missing_priority DESC, city_key, id
LIMIT 5000;
