-- STAGING ONLY. When Geoapify results are debited, persist independently
-- licensed OSM identity in the SAME transaction. If either step fails, both
-- roll back. Never retain Google Places Content beyond Place IDs.
create or replace function public.claim_daily_maps_with_osm_anchors(
  p_user_id uuid,p_place_ids text[],p_verified_aliases jsonb,p_osm_places jsonb
) returns jsonb
language plpgsql volatile security invoker set search_path=''
as $$
declare v_receipt jsonb;
begin
  if p_osm_places is null or jsonb_typeof(p_osm_places)<>'array'
    or jsonb_array_length(p_osm_places)>35 then
    raise exception 'Invalid independent OSM metadata' using errcode='22023';
  end if;
  v_receipt := public.claim_daily_leads_for_user_with_aliases(
    p_user_id,p_place_ids,'maps',p_verified_aliases
  );
  perform public.record_daily_geoapify_anchors_for_user(p_user_id,p_osm_places);
  return v_receipt;
end;
$$;
revoke all on function public.claim_daily_maps_with_osm_anchors(uuid,text[],jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.claim_daily_maps_with_osm_anchors(uuid,text[],jsonb,jsonb)
  to service_role;
notify pgrst, 'reload schema';
