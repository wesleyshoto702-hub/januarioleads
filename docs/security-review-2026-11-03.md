# Auditoria de segurança — JanuarioLeads (03/11/2026)

Auditoria **somente leitura** sobre o projeto Supabase `czkazbianiflhldenhcj`.
Os testes automatizados verificam partes do SQL, mas não substituem testes reais
de autenticação, APIs e autorização com duas contas.

## Confirmado

- O Supabase relata **0 tabelas físicas em `public` sem RLS**.
- As duas funções SQL `SECURITY DEFINER` identificadas em `public`
  (`claim_api_request_for_user` e `claim_open_now_refresh`) **não concedem
  EXECUTE** às roles `anon` e `authenticated`.
- A produção manteve **197 leads** e **2 contas autorizadas** após a
  conciliação dos metadados de migração.
- Publicações manuais das Edge Functions pelo GitHub Actions funcionam.
  Uma publicação verde não comprova login real, tratamento de erros ou
  comportamento das integrações de terceiros.

## Alertas ainda abertos

1. **Proteção contra senhas vazadas desativada** (Security Advisor).
   A organização `chave` está no plano **Free** (consulta de 03/11/2026).
   Segundo a [documentação de senhas do Supabase](https://supabase.com/docs/guides/auth/password-security),
   essa proteção está disponível apenas no **Pro e superiores**.
   Portanto não foi habilitada nem alterada automaticamente: depende de
   upgrade autorizado pelo proprietário. Enquanto isso, recomendar senhas
   fortes, comprimento adequado e MFA; revisar em
   [Supabase Auth — Email](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/providers?provider=Email).
2. **Extensão `pg_net` instalada no schema `public`** (Security Advisor).
   Auditoria: `pg_net` **v0.20.4** está em `public` e tem
   `extrelocatable=false`; `pg_cron` v1.6.4 está em `pg_catalog`,
   também não relocável. Existe **um job ativo**, `sync-leads-daily`,
   agendado como `0 */8 * * *`, e a auditoria confirma que seu
   comando utiliza HTTP e Vault (sem ler valores de credenciais).
   [Referência do alerta](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
   **Não tentar `ALTER EXTENSION pg_net SET SCHEMA`**: a extensão não é
   relocável. Qualquer recriação em outro schema precisa de procedimento
   suportado, backup/restauração e homologação que preserve Cron e Vault.
   Manter o alerta conhecido é mais seguro do que interromper sincronização.
3. **Sessões e XSS — medidas aplicadas em 03/11/2026:**
   - Pull Request [#21](https://github.com/wesleyshoto702-hub/januarioleads/pull/21)
     integrado à `main`: política `script-src` com **nonce aleatório por
     requisição**, `strict-dynamic`, `script-src-attr 'none'` e `form-action
     'self'` via TanStack Start, com o mesmo nonce no router SSR e preservação
     do cabeçalho em `src/server.ts`. Foi testado em navegador simulado, tipos
     e compilação. O frame-ancestors mantém compatibilidade com o editor Lovable.
   - Commit `5a55728`: `safeExternalHref` em 15 pontos de navegação externa.
   - `src/lib/auth.ts` rejeita sessões armazenadas com estrutura inválida e
     evita cache HTTP nas requisições de autenticação. O formato persistido e
     os tokens de sessões válidas foram preservados; os testes de refresh,
     logout e leitura legada passaram no CI.
   - A implementação opcional de HttpOnly foi integrada à `main` pela
     [PR #22](https://github.com/wesleyshoto702-hub/januarioleads/pull/22):
     BFF same-origin, cookies AES-256-GCM com `HttpOnly`, verificação
     da allowlist e proxy REST/Functions, com testes simulados aprovados.
     **Permanece desativada por padrão** até homologação com Auth real.
     Em produção, access/refresh tokens **ainda permanecem em
     `localStorage`** enquanto o modo legado estiver ativo.
     Ver [plano de liberação e rollback](session-security-migration.md).
   - A CSP restringe scripts, mas ainda exige revisão das dependências
     e validação de ponta a ponta na URL real do aplicativo.

4. **GitHub:** a branch `main` não tinha proteção de branch na auditoria.
   Planejar proteção compatível com o sync bidirecional GitHub–Lovable.

## Próximos testes antes de vender acesso

- Reproduzir login e logout, expiração e atualização de tokens, permissões
  de duas contas e tentativa de acesso a registros de outra conta por REST.
- Testar criação/edição/exclusão de leads, busca e enriquecimento com
  orçamento/quotas controlados, sem usar leads reais para testes destrutivos.
- Verificar políticas Auth, CSP, cabeçalhos de segurança, dependências,
  segredos e backups/restauração.
- Fazer homologação com dados fictícios antes de mudanças sensíveis.

**Este documento não certifica o produto como livre de vulnerabilidades.**

## Lovable — verificação de publicação

O README aponta para o projeto
[Lovable JanuarioLeads](https://lovable.dev/projects/cfc45a7b-7f48-4b0a-82fc-daf876974a6f),
com sincronização de mudanças da `main` para o editor. O repositório informa o endereço público
[https://januleads.vercel.app/login](https://januleads.vercel.app/login).
A [verificação HTTP no GitHub Actions](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41747061455)
confirmou HTTP 200, identidade do aplicativo, CSP com nonce e HSTS no
domínio da Vercel. Isso **não confirma a versão exata do commit publicado**
nem a sincronização interna do Lovable. A ativação do modo HttpOnly não foi
testada neste endereço e continua proibida até staging aprovado.
