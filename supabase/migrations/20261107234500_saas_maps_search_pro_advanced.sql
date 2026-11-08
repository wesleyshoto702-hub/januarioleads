-- Staging-first feature gate: Google Places leads may be displayed on Google Maps
-- only to Pro and Advanced. Free keeps the existing list-based search.
-- No new paid Google API call is introduced by this migration.
INSERT INTO public.saas_plan_features (plan_code, feature_key, enabled)
VALUES ('free','maps_search',false),('pro','maps_search',true),('advanced','maps_search',true)
ON CONFLICT (plan_code,feature_key) DO UPDATE SET enabled=EXCLUDED.enabled;
