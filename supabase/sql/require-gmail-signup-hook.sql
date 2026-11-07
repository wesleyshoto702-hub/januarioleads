-- Implantar primeiro no projeto Supabase de staging, NUNCA automaticamente em produção.
-- No Dashboard > Authentication > Hooks, habilitar "Before User Created"
-- (Postgres) apontando para auth_hooks.require_gmail_signup.
-- Também habilitar Authentication > Providers > Email > Confirm Email.

create schema if not exists auth_hooks;

-- Funções de Auth não devem ser chamadas por clientes REST públicos.
revoke all on schema auth_hooks from public, anon, authenticated;
grant usage on schema auth_hooks to supabase_auth_admin;

create or replace function auth_hooks.require_gmail_signup(event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if candidate !~ '^[^[:space:]@]+@gmail[.]com$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Para criar sua conta, informe um endereço @gmail.com válido.'
      )
    );
  end if;
  return '{}'::jsonb;
end;
$$;

revoke all on function auth_hooks.require_gmail_signup(jsonb) from public, anon, authenticated;
grant execute on function auth_hooks.require_gmail_signup(jsonb) to supabase_auth_admin;
