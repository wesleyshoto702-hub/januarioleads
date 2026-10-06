alter table public.leads
  add column if not exists next_action_type text,
  add column if not exists next_action_date date,
  add column if not exists next_action_notes text;

alter table public.leads
  drop constraint if exists leads_next_action_type_check;

alter table public.leads
  add constraint leads_next_action_type_check
  check (
    next_action_type is null
    or next_action_type = any (
      array[
        'initial_contact'::text,
        'follow_up'::text,
        'send_proposal'::text,
        'wait'::text,
        'meeting'::text,
        'collect_payment'::text,
        'other'::text
      ]
    )
  );

alter table public.leads
  drop constraint if exists leads_next_action_notes_length_check;

alter table public.leads
  add constraint leads_next_action_notes_length_check
  check (
    next_action_notes is null
    or char_length(next_action_notes) <= 500
  );

create index if not exists leads_user_next_action_date_idx
  on public.leads (user_id, next_action_date)
  where next_action_date is not null;

alter table public.lead_activities
  drop constraint if exists lead_activities_type_check;

alter table public.lead_activities
  add constraint lead_activities_type_check
  check (
    type = any (
      array[
        'lead_added'::text,
        'whatsapp_opened'::text,
        'prompt_generated'::text,
        'status_changed'::text,
        'company_updated'::text,
        'lead_edited'::text,
        'deep_enrichment'::text,
        'deep_enrichment_review'::text,
        'manual_note'::text,
        'next_action_set'::text,
        'next_action_completed'::text,
        'follow_up'::text
      ]
    )
  );
