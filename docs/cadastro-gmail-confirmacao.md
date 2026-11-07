# Cadastro apenas com Gmail e confirmação de e-mail

## Comportamento esperado

- **Criar conta** aceita somente endereços `@gmail.com` (sem Google OAuth). Os endereços são normalizados (`trim` + minúsculas).
- A interface e os clientes de cadastro público/beta recusam outros domínios sem enviar requisição ao Supabase.
- A confirmação de posse da caixa de entrada acontece **no Supabase Auth**, por link de confirmação. Um endereço `@gmail.com` escrito no formulário **não prova** que uma conta existe ou pertence ao usuário.
- O login existente continua aceitando contas antigas autorizadas, independentemente do domínio: a restrição vale para **novos cadastros**.
- Confirmar o Gmail **não** concede `private_access`, plano, permissões de CRM ou consumo de Google Places.

## Ativação obrigatória no Supabase (staging)

> Ainda não ativado automaticamente. Não executar em produção antes de homologação, migrações conciliadas e aprovação específica.

1. Usar um **projeto Supabase de staging distinto do ambiente de produção**.
2. Em **Authentication → Providers → Email**, deixar o login por e-mail/senha ativo e habilitar **Confirm Email**. Sem isso o Supabase pode confirmar contas automaticamente ou emitir sessões no cadastro, e a mera validação no frontend não fornece segurança.
3. Em **Authentication → URL Configuration**, definir a Site URL da aplicação de teste e autorizar explicitamente `https://<dominio-de-staging>/login` como URL de redirecionamento.
4. Configurar SMTP/entrega de e-mail para os destinatários de teste permitidos; o serviço padrão do Supabase pode não enviar para qualquer destinatário.
5. Aplicar manualmente `supabase/sql/require-gmail-signup-hook.sql` no **SQL Editor do staging**. Esse SQL cria a função em um schema não exposto, concedendo execução somente a `supabase_auth_admin`.
6. Em **Authentication → Hooks → Before User Created**, habilitar a opção **Postgres** e selecionar `auth_hooks.require_gmail_signup`. **Criar somente a função SQL não habilita o hook.**
7. Só depois habilitar o formulário no ambiente correto. Preservar as proteções de staging descritas em `docs/cadastro-beta-staging-2026-11-06.md`; não reutilizar credenciais/chaves de produção.

Atenção: o hook funciona para **criação de identidade Auth em geral**, inclusive criações diretas via API/admin. Se houver processos legítimos que precisam criar usuários não Gmail, a política deve ser revista antes de ativá-lo.

## Teste de homologação

- `pessoa@outlook.com` e `pessoa@gmail.com.evil.test` → rejeitados pelo frontend e pelo endpoint direto do Supabase com o hook ativado.
- `PESSOA@GMAIL.COM` → normalizado para minúsculas e permitido a **solicitar** cadastro (não significa que o endereço existe).
- Gmail real e novo → recebe link; antes de clicar, login por senha deve ser recusado; após confirmar, login é possível **somente se** a conta também tiver autorização para o CRM.
- Gmail inexistente → a conta não consegue concluir a confirmação, mesmo que uma solicitação tenha sido aceita pelo Auth.
- Gmail já cadastrado → resposta neutra, sem enumerar existência de conta.
- Conta autorizada existente de outro provedor → login continua funcionando.
- Verificar limites de envio, ausência de tokens persistidos pelo fluxo de cadastro e isolamento dos leads por `user_id`.

### Verificar a função diretamente no SQL Editor de staging

```sql
select
  auth_hooks.require_gmail_signup('{"user":{"email":"teste@gmail.com"}}'::jsonb) as permitido,
  auth_hooks.require_gmail_signup('{"user":{"email":"teste@outlook.com"}}'::jsonb) as rejeitado;
```

Resultado esperado: `{}` para Gmail e um objeto `error` para Outlook.

## Status

A branch desta entrega contém **frontend, validação no cliente, testes, SQL para implantação controlada e instruções**. A garantia de verificação de propriedade e a barreira real do servidor dependem de habilitar **Confirm Email** e **Before User Created Hook** no projeto Supabase de staging, testar fim a fim, e só então planejar a promoção. Não confundir um PR aprovado com configuração de Auth ativada na produção.

Documentação oficial: [Supabase Confirm Email](https://supabase.com/docs/guides/auth/general-configuration) e [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).
