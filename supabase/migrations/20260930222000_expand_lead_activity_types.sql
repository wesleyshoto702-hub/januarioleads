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
        'manual_note'::text
      ]
    )
  );
