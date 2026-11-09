-- STAGING ONLY. One saved CRM record per user and provider Place ID.
-- Guards concurrent tabs while preserving manual leads with NULL place_id.
-- Cross-provider aliases continue to be checked in application/backend logic.
-- Applied to Supabase staging project, NOT production.
create unique index if not exists leads_user_place_id_staging_unique_idx
  on public.leads (user_id, place_id)
  where place_id is not null;
