-- Preserve visual-reference cache while allowing a reference to be removed from the active company set.
alter table public.prompt_visual_references
  add column active boolean not null default true,
  add column removed_at timestamptz;

alter table public.prompt_visual_references
  alter column sort_order drop not null;

alter table public.prompt_visual_references
  add constraint prompt_visual_references_active_shape_check
  check (
    (
      active = true
      and sort_order is not null
      and removed_at is null
    )
    or
    (
      active = false
      and sort_order is null
      and removed_at is not null
    )
  );

create index prompt_visual_references_active_set_idx
  on public.prompt_visual_references (set_id, sort_order)
  where active = true;
