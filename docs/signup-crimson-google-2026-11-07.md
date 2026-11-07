# Cadastro exclusivamente com conta Google verificada — 07/11/2026

## Decisão de produto

Novos cadastros do Januário Leads agora são iniciados **exclusivamente pelo Google OAuth**, que valida a identidade e o controle da conta. Não basta digitar `@gmail.com` — a existência ou titularidade de um e-mail não pode ser comprovada por um formulário comum.

**Importante:** uma conta Google pode usar um e-mail `@gmail.com` **ou um endereço não Gmail associado a uma Conta Google**. O requisito implementado é **conta Google validada**, não **domínio Gmail exclusivamente**.

O login existente por e-mail/senha para usuários antigos **permanece disponível**. Não foram migradas contas existentes nem redefinidas senhas.

## Implementação no aplicativo

- `/cadastro` agora apresenta somente **Criar conta com Google**, dentro do design carmesim aprovado e com a aurora existente.
- O formulário de novo cadastro por nome/e-mail/senha foi removido da interface; o antigo `requestPublicSignup` foi removido do módulo público.
- O botão verifica se o provedor Google foi ativado no Supabase e só então abre a autenticação OAuth.
- O OAuth usa **PKCE S256** e `state` de uso único ligado ao mesmo navegador, com expiração.
- No retorno, o aplicativo consulta `/auth/v1/user` no Supabase para confirmar **identidade Google** e **e-mail confirmado** antes de verificar `private_access`.
- **Autenticação Google ≠ autorização do CRM**: sem `private_access`, a sessão não é armazenada, o token é revogado e a pessoa recebe uma explicação. Nenhum usuário é incluído automaticamente na allowlist.
- O fundo animado da página de cadastro é o mesmo `AuroraBackdrop` usado nas outras telas.

## Configuração externa AINDA NECESSÁRIA

As ferramentas de acesso a Supabase e GitHub disponíveis nesta sessão **não permitem alterar as configurações de provedores de Auth** nem criar OAuth Client IDs no Google Cloud. Por isso, **o provedor Google não foi ativado no Supabase**, e **Client ID / Client Secret não foram criados ou inseridos**. O formulário fica protegido contra cadastros por e-mail na interface, mas isso sozinho **não bloqueia chamadas HTTP diretas ao endpoint Supabase Auth de signup**.

### Ativar o Google OAuth

1. Acesse [Google Auth Platform](https://console.cloud.google.com/auth/overview) com a conta administradora. Configure **Branding**, **Audience** (interno/externo, usuários de teste enquanto não houver publicação) e os escopos `openid`, `email` e `profile`.
2. Em [Clients](https://console.cloud.google.com/auth/clients), crie um **OAuth Client ID** do tipo **Web application**. Em *Authorized JavaScript origins*, adicione o endereço real do seu site (e o local de desenvolvimento quando aplicável). Em *Authorized redirect URIs*, insira **exatamente** `https://czkazbianiflhldenhcj.supabase.co/auth/v1/callback`.
3. Copie Client ID e **Client Secret** diretamente para [Supabase → Authentication → Providers → Google](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/providers), habilite Google e salve. **Nunca coloque Client Secret no repositório, em variáveis `VITE_*` nem no chat.**
4. Em [Supabase → Authentication → URL Configuration](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/url-configuration), configure o domínio em que o site estiver realmente publicado e permita a URL `/auth/retorno` incluindo os parâmetros do OAuth (o código envia `?state=...`). Configure localhost somente para testes de desenvolvimento.
5. **Para impor a restrição no servidor**, desative **novos cadastros por e-mail** no Auth do Supabase, mantendo o provedor de login por senha para contas já existentes. Verifique a configuração específica **Allow email signups / Enable email signups**, pois desligar por completo o provedor Email pode quebrar a autenticação de usuários antigos. Se essa opção específica não estiver disponível, use um **Before User Created Hook** que recuse o provedor `email` e aceite somente `google`, testado primeiro em staging.
6. Após configurar, teste em ambiente não público: Google habilitado e desabilitado; conta Google com email confirmado; conta não autorizada; conta autorizada; cancelamento de login; recusa do cadastro por e-mail via API; usuários antigos por senha; mobile. Só então republique, caso queira.

> **Não ativar o provedor ou o bloqueio backend sem as credenciais e sem validar o efeito sobre as contas existentes.** Nenhuma alteração foi executada no Auth hospedado.

## Garantias e limites

- **Implementado no frontend:** apenas Google para novas contas; validação de Google + e-mail confirmado no callback.
- **Ainda pendente no backend:** ativar Google e impedir *qualquer* novo cadastro de usuário por e-mail, inclusive chamadas diretas ao endpoint Supabase Auth. A interface sozinha não controla isso.
- **CRM permanece restrito:** `private_access` é obrigatório, com política RLS `auth.uid() = user_id`.
- Google OAuth não garante que uma pessoa nunca perderá acesso à conta ou que endereços associados jamais mudarão. Confirma a identidade fornecida pelo provedor no momento da autenticação.
- A hospedagem Vercel foi despublicada pelo administrador e não é alterada por esta PR.

Referências:
- [Supabase: Sign in with Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase: Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
- [Supabase: Email/password sign-in](https://supabase.com/docs/guides/auth/passwords)
