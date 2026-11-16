-- Colab V1 | Histórico das empresas Overture já tentadas na Geoapify
-- SOMENTE LEITURA; STAGING; depois da Fase 0.
-- Rode esta consulta separadamente e exporte resultado para:
-- overture_geoapify_enrichment.csv
-- Retorne TODOS os IDs anteriores: inclusive 'no_match', para evitar
-- reconsultas inúteis ou consumo repetido de créditos.
SELECT overture_id, status
FROM public.overture_geoapify_enrichment
ORDER BY overture_id;
