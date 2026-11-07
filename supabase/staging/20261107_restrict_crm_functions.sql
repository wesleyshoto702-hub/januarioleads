-- SOMENTE STAGING. Espelhar as ACLs de funcoes privilegiadas da producao.
-- Um baseline restaurado numa base Supabase nova herda grants explicitos
-- de EXECUTE para anon/authenticated. REVOKE FROM PUBLIC sozinho nao remove
-- esses grants. Nao modificar Auth ou contas existentes.
revoke execute on function public.claim_api_request_for_user(uuid,text)
  from public, anon, authenticated;
revoke execute on function public.claim_open_now_refresh(uuid,text,integer,integer)
  from public, anon, authenticated;
revoke execute on function public.record_lead_added_activity()
  from public, anon, authenticated;
revoke execute on function public.set_leads_updated_at()
  from public, anon, authenticated;

grant execute on function public.claim_api_request_for_user(uuid,text)
  to service_role;
grant execute on function public.claim_open_now_refresh(uuid,text,integer,integer)
  to service_role;
grant execute on function public.record_lead_added_activity()
  to service_role;
grant execute on function public.set_leads_updated_at()
  to service_role;
