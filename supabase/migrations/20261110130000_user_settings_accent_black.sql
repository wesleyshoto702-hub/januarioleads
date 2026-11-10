-- Adds the graphite "black" accent option. Cosmetic preference only.
alter table public.user_settings
  drop constraint if exists user_settings_accent_color_check;
alter table public.user_settings
  add constraint user_settings_accent_color_check
  check (accent_color in ('green','yellow','blue','red','white','black'));
