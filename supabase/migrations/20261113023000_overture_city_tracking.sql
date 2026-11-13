-- Live per-municipality Overture progress and cumulative UF totals.
-- Neither an imported sample nor the state status implies complete coverage.
-- Publicly exposed schema: security_invoker and restricted privileges.

CREATE OR REPLACE FUNCTION public.overture_sync_imported_rows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $func$
BEGIN
  SELECT count(*)::integer INTO NEW.imported_rows
  FROM public.overture_places
  WHERE state = NEW.state;
  RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.overture_sync_imported_rows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS overture_import_progress_count_sync ON public.overture_import_progress;
CREATE TRIGGER overture_import_progress_count_sync
BEFORE INSERT OR UPDATE ON public.overture_import_progress
FOR EACH ROW EXECUTE FUNCTION public.overture_sync_imported_rows();

CREATE OR REPLACE VIEW public.overture_import_city_progress
WITH (security_invoker = true)
AS
SELECT state,
       city,
       city_key,
       count(*)::integer AS imported_rows,
       count(*) FILTER (WHERE phone IS NOT NULL)::integer AS with_phone,
       count(*) FILTER (WHERE email IS NOT NULL)::integer AS with_email,
       count(*) FILTER (WHERE website IS NOT NULL)::integer AS with_website,
       count(*) FILTER (WHERE instagram IS NOT NULL)::integer AS with_instagram,
       max(updated_at) AS last_place_update
FROM public.overture_places
GROUP BY state, city, city_key;

REVOKE ALL ON TABLE public.overture_import_city_progress FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.overture_import_city_progress TO service_role;

COMMENT ON VIEW public.overture_import_city_progress
IS 'Actual imported Overture rows by municipality; not a claim of full geographic coverage. Only service_role can query.';

-- Fix historical counters; subsequently the trigger overrides per-run batch totals.
UPDATE public.overture_import_progress SET imported_rows = imported_rows;
