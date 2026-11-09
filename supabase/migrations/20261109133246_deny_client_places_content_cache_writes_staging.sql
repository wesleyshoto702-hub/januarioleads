-- STAGING ONLY. Google Places Search results are transient, not a CRM cache.
-- The legacy places_search_cache is empty in this isolated project.
-- Prevent any browser role from reintroducing persistent provider content.
-- Service-role maintenance remains possible for future independently licensed sources.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON TABLE public.places_search_cache
FROM PUBLIC, anon, authenticated;
