# Sessões HttpOnly — implementação e plano de liberação

## Estado confirmado (03/11/2026, America/Sao_Paulo)

A implementação do BFF same-origin foi integrada à branch `main`
pela [PR #22](https://github.com/wesleyshoto702-hub/januarioleads/pull/22).
**Está desativada por padrão** e não foi habilitada na hospedagem.

### Componentes existentes

- `src/lib/bff-session-cookie.server.ts`: criptografia AES-256-GCM com
  chave privada de 32 bytes, IV aleatório e cookie
  `__Host-januarioleads-session` com `Secure; HttpOnly; SameSite=Lax; Path=/`.
  **A sessão está cifrada dentro do cookie**, não em um armazenamento
  de sessão no servidor. Portanto não é um ID opaco e não oferece
  revogação granular própria independente do Auth.
- `src/lib/bff-server.server.ts` e `src/server.ts`: rotas
  `/api/session` e `/api/supabase/{rest,functions}/v1/*` protegidas por
  validação de identidade no Supabase Auth, consulta da allowlist
  `private_access` e repasse do JWT do usuário (com RLS preservado).
  Verificação de `Origin`/Fetch Metadata em mutações.
- `src/lib/auth.ts` e `src/lib/supabase-config.ts`: implementação
  opt-in por build. Em modo BFF, o navegador armazena só um identificador
  e marcadores sem poder de autenticação; **não armazena access/refresh
  tokens reais**. O modo antigo continua padrão.
- Testes automatizados do fluxo login, proxy, logout, CSRF, criptografia,
  tipos, build e navegador simulado aprovados no CI.
  [Execução específica de BFF](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41746972548).
  [Execução da main após merge](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/41747240991).

### Flags e segredos para ambiente de *homologação somente*

Build do frontend:
- `VITE_HTTPONLY_SESSION=true` para escolher o BFF no navegador.

Runtime do servidor:
- `BFF_HTTPONLY_ENABLED=true`
- `BFF_SESSION_KEY` = 32 bytes obtidos de gerador criptográfico,
  codificados em base64url; segredo **exclusivo do backend**, nunca no GitHub.
- `BFF_SUPABASE_URL` = URL HTTPS de projeto Supabase **separado**.
- `BFF_SUPABASE_PUBLISHABLE_KEY` = publishable key pública desse projeto.
- **Não configurar `BFF_ALLOW_PRODUCTION=true`**: o bloqueio de produção
  deve permanecer ativo até testes completos e aprovação explícita.

Ambas as flags devem ser coerentes no mesmo deploy. Os segredos devem
ser inseridos diretamente na hospedagem de staging (nunca em `VITE_*`,
Git, README, logs ou mensagens de chat).

### Bloqueios de liberação

- [ ] Projeto Supabase de homologação provisionado sem copiar dados de clientes.
- [ ] Duas contas fictícias autorizadas na `private_access`, segredos de
      staging configurados e workflow `staging-rls.yml` aprovado.
- [ ] Deploy de pré-visualização no domínio HTTPS próprio com ambas as
      flags; login/logout, refresh e autenticação com duas contas reais.
- [ ] Avaliar rejeição de cookies ausentes/adulterados, CSRF,
      limitação de tentativas, revogação da sessão no servidor,
      concorrência de refresh (múltiplas abas), falha de rede, restauração,
      isolamento em REST/Functions e integração com todas as telas.
- [ ] Validar que rollback não perde sessão/dados e definir transição
      do `localStorage` antigo sem reutilizar tokens legados sem proteção.
- [ ] Confirmar publicação Lovable/Vercel e cabeçalhos na URL real.

**Não habilitar HttpOnly em produção ainda.** A fase de implementação e
testes simulados terminou. A homologação e ativação final ainda não.

## Rollback

Se algum teste de staging falhar, definir
`VITE_HTTPONLY_SESSION=false` no build e
`BFF_HTTPONLY_ENABLED=false` no runtime; publicar somente o ambiente
de staging. Isso mantém o fluxo de login legado. Não alterar Auth,
migrações ou cookies de produção para realizar esse rollback.

## Limitação importante

A PR contém um BFF funcional com cookie cifrado, não um sistema completo
de sessões opacas armazenadas no backend. Para exigências maiores (SaaS
com assinantes) planejar armazenamento de sessão revogável no servidor
e proteção contra sessões roubadas antes de ampliar o uso.

## Correção de logout — 04/11/2026

O BFF agora exige resposta de sucesso do Supabase Auth antes de apagar o cookie.
Falhas HTTP e de rede retornam 503 sem Set-Cookie, preservando a possibilidade de
nova tentativa. O frontend mantém a sessão e mostra o erro. Há regressões para
401/403/429/500/503, falha de rede e retry bem-sucedido, além do teste de navegador
com backend simulado. Isso não substitui a homologação real ou resolve por si só
revogação de JWTs já emitidos, concorrência distribuída e múltiplas abas.
As flags de produção continuam desativadas.
