-- Add the operational "Enviar mensagem" status without modifying existing leads.
alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
  check (status = any (array[
    'send_message'::text,
    'waiting'::text,
    'accepted'::text,
    'rejected'::text
  ]));

alter table public.leads
  alter column status set default 'send_message'::text;

create or replace function public.record_lead_added_activity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  status_label text;
begin
  status_label := case new.status
    when 'send_message' then 'Enviar mensagem'
    when 'waiting' then 'Aguardando'
    when 'accepted' then 'Aceito'
    when 'rejected' then 'Recusado'
    else new.status
  end;

  insert into public.lead_activities (
    lead_id,
    user_id,
    type,
    title,
    description,
    metadata,
    created_at
  )
  values (
    new.id,
    new.user_id,
    'lead_added',
    'Empresa adicionada aos Meus Leads',
    'Status inicial: ' || status_label,
    jsonb_build_object(
      'initialStatus', new.status,
      'initialStatusLabel', status_label
    ),
    new.created_at
  )
  on conflict do nothing;

  return new;
end;
$function$;
