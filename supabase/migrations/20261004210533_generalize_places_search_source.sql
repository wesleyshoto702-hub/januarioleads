alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check
  check (
    source is null
    or source in ('manual','lavras-search','places-search')
  );
