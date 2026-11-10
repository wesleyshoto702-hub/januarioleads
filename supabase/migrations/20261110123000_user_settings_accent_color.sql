-- Individual color scheme: Workspace always stays dark; no privileged settings.
-- Does not change existing leads, sessions, billing, or account access.
alter table public.user_settings
  add column if not exists accent_color text not null default 'red';

alter table public.user_settings
  drop constraint if exists user_settings_accent_color_check;
alter table public.user_settings
  add constraint user_settings_accent_color_check
  check (accent_color in ('green','yellow','blue','red','white'));

comment on column public.user_settings.accent_color is
  'Validated cosmetic color preference per authenticated account; never an authorization claim.';
