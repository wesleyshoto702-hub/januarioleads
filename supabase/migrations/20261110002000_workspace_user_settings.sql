-- Individual settings, not an extra CRM module.
-- No existing leads, message templates, or billing rows are changed.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  home_view text not null default 'dashboard'
    check (home_view in ('dashboard','leads','search','prospecting','opportunities','messages','finance')),
  compact_mode boolean not null default false,
  reduce_motion boolean not null default false,
  notify_due_today boolean not null default true,
  notify_overdue boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from public, anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;

create policy "Users see their own settings"
on public.user_settings for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users create their own settings"
on public.user_settings for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users update their own settings"
on public.user_settings for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

comment on table public.user_settings is
  'Per-user workspace preferences; never stores API keys or role/plan authorization.';
