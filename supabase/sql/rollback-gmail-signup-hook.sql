-- Plano de reversão controlado para auth_hooks.require_gmail_signup.
-- ANTES de aplicar esta reversão:
-- 1. Authentication > Hooks > Before User Created: desabilitar o hook.
-- 2. Testar cadastro de um usuário de teste no ambiente apropriado.
-- 3. Só então executar o SQL abaixo; nunca remover função ativa no Auth.
--
-- Reverte apenas o hook de restrição de Gmail; não altera contas existentes.
drop function if exists auth_hooks.require_gmail_signup(jsonb);
-- Não remover o schema auth_hooks: outros hooks podem usá-lo.
