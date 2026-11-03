-- Persist the publicly indexed Instagram display name separately from the @handle.
-- This field is nullable: an official link may provide the username without
-- disclosing the exact current profile display name.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS instagram_display_name text;
