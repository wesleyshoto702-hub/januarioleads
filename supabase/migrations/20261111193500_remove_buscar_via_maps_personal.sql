-- Remove only the dedicated personal Buscar via Maps server-side state.
-- The production Buscar Leads function (search-places) and its shared catalog
-- are intentionally preserved.
-- Safe on both original and staging environments; no CASCADE.
DROP FUNCTION IF EXISTS public.claim_personal_geoapify_search();
DROP TABLE IF EXISTS public.personal_maps_daily_limit_control;
DROP TABLE IF EXISTS public.personal_maps_daily_usage;
