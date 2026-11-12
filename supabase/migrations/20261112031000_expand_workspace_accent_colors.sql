-- Expand the saved per-account accent choice without changing user data,
-- existing RLS policies, defaults, or any other settings column.
ALTER TABLE public.user_settings
  DROP CONSTRAINT user_settings_accent_color_check;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_accent_color_check
  CHECK (accent_color IN (
    'green', 'yellow', 'blue', 'red', 'white', 'black',
    'purple', 'cyan', 'orange', 'pink', 'indigo'
  ));
