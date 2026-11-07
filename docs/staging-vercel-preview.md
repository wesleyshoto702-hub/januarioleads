# Publicação isolada: Januário Leads Staging (Vercel Preview + Supabase)

## Recursos confirmados

- Código para cadastro exclusivo com Gmail: PR #82, branch `feature/cadastro-gmail-verificado`.
- Supabase de testes: ref `prlrxjothrslhswpkoza`, URL `https://prlrxjothrslhswpkoza.supabase.co` (São Paulo).
- Supabase de produção: ref `czkazbianiflhldenhcj`. **Nunca reutilizar esta URL ou chave no Preview**.
- Em staging, **Confirm Email** está ligado e o Auth Hook **Before User Created** usa `auth_hooks.require_gmail_signup`.
- `VITE_DEPLOY_TARGET=staging` ativa uma verificação no frontend que impede o fallback silencioso para a URL/chave de produção.
- O endereço público da Vercel **ainda precisa ser efetivamente gerado**. Não inferir ou inventar o hostname.

## 1. Hospedar a branch de staging na Vercel

1. Entrar em [Vercel Dashboard](https://vercel.com/dashboard) e identificar o projeto existente que publica o Januário Leads a partir do GitHub `wesleyshoto702-hub/januarioleads`.
2. Confirmar que a branch de produção é `main`.
3. A branch `feature/cadastro-gmail-verificado` já existe e o PR #82 está aberto em draft. Se o repositório estiver conectado à Vercel, ela normalmente produz um **Preview Deployment** ao detectar o PR/commit. Se não estiver, vincular o repositório à Vercel antes de publicar.
4. Usar preferencialmente um **URL estável de branch** em vez de um URL que muda por commit, sempre que disponível.
5. Antes de abrir o preview para testes de cadastro, **configurar as variáveis abaixo** para o ambiente **Preview**, limitadas especificamente à branch `feature/cadastro-gmail-verificado` se a UI permitir. Assim não se alteram as variáveis do ambiente Production.
6. Criar/recriar o deployment da branch após configurar as variáveis. Não clicar em `Promote to Production`, não alterar o domínio de produção e não fazer merge em `main`.

## 2. Variáveis Vercel necessárias no Preview (escopo da branch)

```dotenv
VITE_DEPLOY_TARGET=staging
VITE_SUPABASE_URL=https://prlrxjothrslhswpkoza.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_COLE_A_CHAVE_PUBLICA_DE_STAGING
VITE_HTTPONLY_SESSION=false
VITE_BETA_SIGNUP_ENABLED=false
```

Copiar a chave **publishable pública** real do projeto staging no painel do Supabase (Project Settings / API Keys). **Não** configurar `service_role` ou `secret` no frontend. O cadastro normal em `src/lib/public-registration.ts` usará o Supabase staging com nome completo e senha. `VITE_BETA_SIGNUP_ENABLED=false` mantém desativado o fluxo beta alternativo, mas não desativa o formulário da página `/cadastro`: o cadastro público comum continua disponível na branch de testes.

**Não** inserir `GOOGLE_PLACES_API_KEY`, `OPENAI_API_KEY` ou as credenciais/Edge Functions de produção no ambiente de testes. Busca de leads/CRM não integra a homologação de Auth; não prometer que essas funcionalidades funcionarão no banco novo e vazio.

Se houver configuração server-side ou BFF específica do site, manter `VITE_HTTPONLY_SESSION=false` neste Preview de cadastro.

## 3. Supabase Staging → Authentication → URL Configuration

**Somente após a Vercel apresentar a URL real da branch:**

- **Site URL:** `https://HOST-REAL-DA-BRANCH.vercel.app` (sem /login).
- **Redirect URLs:** adicionar exatamente `https://HOST-REAL-DA-BRANCH.vercel.app/login`, sem wildcard e sem usar o site de produção.
- Se o endereço estável incluir um domínio próprio, usar esse domínio real (HTTPS) em vez do exemplo.
- Verificar que a URL de redirecionamento na solicitação de signup corresponde à URL publicada; ela é gerada dinamicamente de `window.location.origin` e `/login`.

As opções `Confirm email` e `Before User Created` já foram vistas como ativas no painel de staging. Não reconfigurar o projeto de produção.

## 4. Verificação obrigatória após publicação

1. Abrir `https://HOST-REAL-DA-BRANCH.vercel.app/cadastro` e confirmar o visual e os campos.
2. Enviar e-mail Outlook falso e verificar mensagem de erro sem chamada de signup.
3. Validar que um `POST /auth/v1/signup` diretamente ao **Supabase staging**, com e-mail não Gmail, é bloqueado pelo hook. Não testar no Supabase de produção.
4. Com uma conta Gmail de teste real e autorização do titular, solicitar cadastro uma vez. Confirmar o recebimento da mensagem; antes de clicar, o usuário ainda não deve conseguir autenticar por senha.
5. Clicar no link de confirmação e verificar que o navegador retorna à rota `/login` **do Preview**; depois verificar `email_confirmed_at` no usuário de teste.
6. O login no CRM pode continuar bloqueado pela falta de `private_access` e/ou schema do CRM no staging: **isso é esperado e seguro**. A confirmação do e-mail não concede acesso ao produto.
7. Verificar envio de e-mails (limites e destinatários permitidos pelo SMTP configurado), erros 429, logs do Auth e isolamento completo de produção.

## Restrições conhecidas

- O repositório e o Supabase staging podem ser gerenciados aqui, mas **não é possível confirmar ou criar um endereço Vercel sem acesso à conta da hospedagem**. Registrar a URL somente após o deploy real.
- Não configurar redirects com um hostname inventado.
- Se o preview estiver protegido pela Vercel Authentication, o testador pode precisar autenticar-se na Vercel antes de abrir o link recebido no e-mail. Conferir `Deployment Protection` de acordo com quem vai testar.
- Alterações nas variáveis exigem nova implantação para que sejam incorporadas ao build.
- A branch #82 segue em draft, sem implantação em produção.

Referências: [Vercel Preview](https://vercel.com/docs/deployments/environments), [Vercel Environment Variables](https://vercel.com/docs/environment-variables), [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
