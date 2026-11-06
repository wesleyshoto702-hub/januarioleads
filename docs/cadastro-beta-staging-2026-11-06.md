# Januário Leads — Cadastro beta em staging (06/11/2026)

## O que está pronto

A rota pública `/cadastro` informa a situação do beta e **não faz chamadas externas quando fechada**. A página comercial `/` aponta para ela como "Como funciona o beta".

Foi preparado um formulário opcional, com confirmação de senha e aceitação explícita de participação no teste, que usa Supabase Auth **somente em um projeto separado de staging**. O fluxo de email/senha usa `POST /auth/v1/signup`, conforme as [orientações do Supabase Auth](https://supabase.com/docs/guides/auth/passwords). O código não lê nem guarda tokens retornados pelo endpoint.

Por padrão `VITE_BETA_SIGNUP_ENABLED` está ausente/desativada, então o formulário não aparece, não envia requisições e não oferece botão para criar contas. Habilitar o cliente **não** cria plano, assinatura, workspace, entitlement ou liberação do CRM.

## Preparação de homologação (quando houver projeto aprovado)

Use um projeto Supabase distinto de `czkazbianiflhldenhcj`. **Não** habilite o formulário apontando para produção. Não reutilize as chaves de produção.

Configure, no **ambiente de teste** (somente):

```env
VITE_BETA_SIGNUP_ENABLED=true
VITE_BETA_SIGNUP_PROJECT_REF=abcdefghijklmnopqrst
VITE_BETA_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
VITE_BETA_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUIR_PELA_CHAVE_PUBLICA_DE_STAGING
VITE_HTTPONLY_SESSION=false
```

Os valores acima são exemplos, não um projeto criado de fato. O projeto de 20 caracteres deve coincidir com o hostname, ser diferente de produção e usar HTTPS e uma chave publicável. O cliente recusa BFF experimental, ref de produção, caminhos/portas inesperados e URLs fora de `*.supabase.co`.

**O projeto staging ainda não foi criado e nenhuma dessas variáveis foi configurada na hospedagem.** Não contrate serviços pagos automaticamente. Use somente dados de teste e contas autorizadas para testes.

## Checklist antes de habilitar o formulário em staging

1. Configurar Supabase Auth no projeto isolado: email/senha, confirmação de e-mail, Site URL e redirects autorizados (`/login`) em URL Configuration.
2. Verificar o método de envio de e-mails. O provedor padrão de e-mail do Supabase tem restrições de destinatários e limite de envio, e não deve ser assumido como entrega comercial geral. Não prometer recebimento até testar de fato.
3. Exigir **ativação de acesso independente**. Registrar em `auth.users` não significa autorização para ler `private_access`, clientes, leads ou consumir APIs. Em produção, a conta só pode entrar no CRM se as permissões existentes permitirem.
4. Testar com backend e conta falsos, via rede isolada. Verificar confirmação e redirecionamento sem guardar tokens no navegador de teste do checkout/landing.
5. Publicar política de privacidade, termos de uso e canal de atendimento antes de convidar o público geral a fornecer e-mail.
6. Configurar controles do lado do servidor para cadastro aberto, abuso, quotas, limites de e-mail e verificação humana quando apropriado. Uma feature flag `VITE_*` **não é um mecanismo de segurança** contra chamadas diretas ao Auth.
7. Validar recuperação de senha, confirmação de e-mail e autorização/ativação em fluxo integrado; o cadastro beta não implementa esses requisitos restantes.

## Testes implementados

- `src/lib/beta-registration.test.ts`: configuração staging, rejeição do ref de produção, URLs inválidas, envio simulado de cadastro, falhas, 429 e descarte de tokens.
- `tests/browser/beta-registration.spec.ts`: página fechada, zero chamadas externas, navegação da landing e layout em 360 px.
- Nenhum teste usa contas reais, envia e-mails, registra usuários ou consome o Supabase de produção.

## Limites desta PR

- Não cria contas reais, não ativa assinaturas e não altera produção.
- Não altera migrations, RLS ou o projeto de Auth de produção.
- Não configura backend de cobrança, webhooks ou API de planos.
- O fluxo de ativação manual ou por assinatura precisa de especificação e testes próprios antes de convidar usuários comerciais.
- A rota `/app` permanece protegida pela validação existente e pela allowlist `private_access`.

Referências: [Supabase Auth Passwords](https://supabase.com/docs/guides/auth/passwords), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [roadmap SaaS](roadmap-saas-2026-11-06.md) e issue #49.
