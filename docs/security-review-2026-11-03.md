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
   O proprietário precisa conferir o painel
   [Supabase Auth — Email](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/providers?provider=Email)
   e habilitá-la **se o plano permitir (Pro ou superior)**.
   [Documentação Supabase](https://supabase.com/docs/guides/auth/password-security).
   Se a funcionalidade não estiver disponível, exigir boas senhas e considerar MFA.
2. **Extensão `pg_net` instalada no schema `public`** (Security Advisor).
   [Referência do alerta](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
   **Não mover automaticamente** a extensão: as rotinas de sincronização
   (`pg_cron`/`pg_net`) podem depender dela. Primeiro inventariar
   dependências, fazer backup e validar em ambiente de homologação.
3. **Sessões no frontend:** `src/lib/auth.ts` persiste access/refresh tokens
   em `localStorage`. A revisão de XSS/CSP e eventual migração para
   sessão gerenciada por servidor precisam de projeto e testes específicos;
   não alterar esse armazenamento silenciosamente para não invalidar sessões.
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
