# PR #36 — Liberação de RLS de revogação: checklist e bloqueios (NÃO É AUTORIZAÇÃO DE DEPLOY)

**Data de referência:** 05/11/2026  
**Projeto Supabase hospedado:** `czkazbianiflhldenhcj` (único projeto conectado)  
**Repositório:** `wesleyshoto702-hub/januarioleads`  
**Correção candidata:** PR #36, SQL em `docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt`  
**Plano de reversão:** `docs/proposals/private-access-revocation-rollback-2026-11-05.sql.txt`  
**Status:** preparação validada; **não executar SQL de escrita/DDL em produção** até aprovação específica.

## 1. O que já foi confirmado por leitura (sem acessar dados pessoais)

- Supabase PostgreSQL 17, projeto `ACTIVE_HEALTHY`.
- As quatro tabelas `private_access`, `lead_payments`,
  `places_search_cache` e `open_now_niche_cache` possuem RLS.
- Os sete registros originais de `pg_policies` nas quatro tabelas
  correspondem ao inventário de 05/11 (incluindo uma política de INSERT
  de pagamentos que **não** será alterada). Role `authenticated`,
  política `PERMISSIVE`, grant SELECT/INSERT/UPDATE e hashes dos
  predicados foram verificados **sem ler registros de leads/clientes**.
- Ledger remoto: **51 versões**, última `20261103220000`, fingerprint
  global do inventário `ef7e5322cd32dd08de9b039694d8b2a8`.
- Ainda existem **27 versões de migrations históricas somente no
  banco remoto**, não reconciliadas em uma trilha local executável.
- Os dois checks read-only criados nesta preparação retornaram
  `PASS` para o estado observado em 05/11/2026:
  - `docs/proposals/rls-release-policy-preflight-20261105.sql`
  - `docs/proposals/rls-release-ledger-preflight-20261105.sql`

**Importante:** `PASS` indica apenas que o estado atual confere com
as expectativas do pacote de revisão. Não prova ausência de bugs,
não implica backup disponível, não autoriza implantação e
**não desbloqueia `db push` nem `migration repair`**.

## 2. Backup e recuperação — bloqueio obrigatório

**Status do gate BACKUP: BLOQUEADO / NÃO VERIFICADO.**

O conector utilizado expõe informações do projeto e permite
consultas SQL, mas **não oferece prova de backup completo restaurável
nem exportação segura de dados de produção**. Confirmei pelo metadado
da organização `gciqfobwezhadpfqqxbb` que o plano atual é
**Free (`tier_free`)**. Esse plano não inclui backups automáticos
diários. **Nenhuma exportação de dados de produção foi realizada
nesta etapa.**

- O procedimento privado para Windows está em
  [`docs/backup-privado-supabase-free-2026-11-05.md`](backup-privado-supabase-free-2026-11-05.md),
  com auxiliar local `scripts/exportar-backup-privado.ps1`.
  Deve ser executado **somente pelo proprietário, no seu computador,
  em volume criptografado**, nunca no GitHub Actions ou no chat.
- Supabase faz backups automáticos diários em Pro/Team/Enterprise;
  no plano Free atual o proprietário precisa de backup manual.
- Antes de qualquer DDL em produção, acessar o Dashboard →
  **Database → Backups**, registrar (em local privado) o ponto de
  recuperação disponível, sua data e o procedimento de restauração.
- Se não houver backup recuperável, obter uma exportação lógica
  **manual e criptografada**, armazenada fora de GitHub, ChatGPT,
  GitHub Actions artifacts e logs públicos.
- Seguir a documentação oficial da CLI para exportar **roles,
  schema e dados** em arquivos privados e confirmar extensão e
  limitações do dump. Consultar `supabase --version` e
  `supabase db dump --help` no ambiente autorizado antes de executar.
- Usar credenciais com permissão mínima, em terminal confiável,
  sem registrá-las em comandos compartilhados, arquivos versionados
  ou parâmetros de logs; jamais enviar aqui uma connection string
  com senha, token ou dump com dados pessoais.
- Checar tamanho e integridade (por exemplo SHA-256 local) e **validar
  uma restauração em destino isolado**. Um backup apenas existente,
  mas não restaurável, não satisfaz a condição.
- A restauração do schema `public` fictício feita pelo CI não
  substitui backup de produção. Backups PostgreSQL não restauram
  necessariamente objetos do Storage API, configurações de Edge
  Functions, Auth externo ou segredos. Preservar esses itens
  por procedimentos próprios, sem copiá-los para o repositório.
- Se o backup/restore exigir infraestrutura paga, confirmar
  custos e obter autorização ANTES da contratação.

Referências oficiais:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## 3. Testes e preflight da mudança

**Status do gate TESTE: APROVADO EM AMBIENTE LOCAL/DESCARTÁVEL.**

- [PR #37](https://github.com/wesleyshoto702-hub/januarioleads/pull/37)
  implantou auditoria do baseline e scripts de homologação local,
  sem DDL de produção.
- [CI #42117704596](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/42117704596)
  confirmou 3 contas fictícias com JWTs verdadeiros em GoTrue e
  chamadas HTTP ao PostgREST: antes da proposta, conta revogada
  acessava próprios registros; depois do patch isolado, não acessava,
  com reautorização e preservação de outra conta.
- A CI executa `scripts/test-database-baseline.sh` em PostgreSQL 17
  **descartável**, validando o preflight antes do patch, a detecção
  de uma política permissiva inesperada, e o postcheck depois do
  patch; nenhum serviço pago é chamado.
- Antes da futura alteração autorizada, **reexecutar imediatamente**
  os dois arquivos `rls-release-*-preflight-20261105.sql` via
  um canal **somente leitura** com acesso ao projeto correto.
  Cada query deve retornar uma única célula `PASS`. Em caso de
  `BLOCKED`, erro SQL ou resultado desconhecido: parar e revisar.
- A verificação de ledger é uma **fotografia com fingerprint fixo**.
  Se o banco receber qualquer outra migration legítima, atualizar
  evidências e código após revisão; jamais falsificar o hash para
  contornar o bloqueio.

## 4. Estratégia de implantação — pendente

**Status do gate MIGRATIONS: BLOQUEADO / NÃO EXECUTÁVEL NO PIPELINE ATUAL.**

- O Supabase mantém 51 registros no ledger remoto e 24 arquivos de
  migrations locais. A mera igualdade dos hashes auditados não
  reconcilia a sequência executável. Não reintroduzir os 27 scripts
  históricos para tentar zerar os avisos.
- A correção permanece em `.sql.txt` dentro de `docs/proposals/`.
  **Não** mover automaticamente para `supabase/migrations` enquanto
  não houver revisão dos históricos sensíveis e estratégia aprovada.
- A preparação deve seguir a CLI oficial, criando a migration por
  `supabase migration new` **após** conferir o `--help` da versão
  instalada, e copiar apenas o SQL revisado; não inventar timestamp.
- Preparar uma execução que aplique **somente** a correção transacional
  aprovada, sem `db reset`, sem `db push` em lote e sem editar
  `supabase_migrations.schema_migrations` manualmente para
  mascarar a divergência. A escolha final do mecanismo deve ser
  revisada e autorizada antes do uso.
- A correção mantém as funções e os grants existentes; não faz DELETE
  de linhas, nem mexe em Auth, Cron, Vault, Storage ou Edge Functions.
- Revisar `lock_timeout=5s` e `statement_timeout=30s`; se a DDL
  encontrar bloqueio, a transação deve falhar sem atualização parcial.
- A execução depende de backup recuperável, relatório de pré-checagem
  vigente, janela de baixo tráfego e aprovação explícita.

## 5. Postcheck e rollback — pendentes para produção

Após eventual aprovação e aplicação **no futuro**:

1. Executar `docs/proposals/rls-release-postcheck-20261105.sql`
   em modo leitura e exigir `PASS`. Esse check garante cinco
   políticas protegidas por `private_access`, permanência da
   política de INSERT dos pagamentos e quatro tabelas com RLS.
2. Usar contas **fictícias/controle** no ambiente autorizado para
   confirmar acesso normal, revogação e reautorização sem comprometer
   registros existentes. Não revogar contas reais como teste.
3. Monitorar erros de PostgREST e problemas de acesso legítimo; não
   expor tokens, dados nem URLs contendo credenciais nos logs.
4. O rollback candidato está em `docs/proposals/private-access-revocation-rollback-2026-11-05.sql.txt`.
   **Atenção: ele RESTAURA A VULNERABILIDADE DE REVOCAÇÃO.**
   Só poderá ser usado com aprovação específica e mitigação
   alternativa. A decisão padrão ao detectar drift **antes** da
   implantação é **não aplicar nada**, não fazer rollback.
5. Preservar evidências do commit, do snapshot, do backup e dos
   testes no local privado apropriado. Não armazenar dumps no Git.

## 6. Outros avisos de segurança não incluídos neste rollout

A leitura do Supabase Security Advisor em 05/11 encontrou duas
advertências separadas: extensão `pg_net` no schema `public` e
proteção de senhas vazadas desativada. Elas **não foram corrigidas**
aqui para não introduzir mudanças não relacionadas; analisar
dependências/planos antes de modificá-las.

- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## 7. Matriz de gates

| Gate | Estado em 05/11/2026 |
| --- | --- |
| Políticas e grants atuais (somente leitura) | **PASS** |
| Ledger atual (somente leitura) | **PASS**, mas histórico executável incompleto |
| GoTrue + PostgREST com JWT real em ambiente temporário | **PASS** |
| SQL de pré/pós-checagem no PostgreSQL isolado | Pendente de CI desta PR |
| Backup completo de produção e restore comprovado | **BLOQUEADO** |
| Plano de aplicação do novo delta sem reexecutar históricos | **BLOQUEADO** |
| Aprovação explícita de escrita em produção | **NÃO CONCEDIDA** |

**Decisão:** nenhuma DDL de produção é permitida enquanto qualquer
gate obrigatório permanecer bloqueado. Este documento não é
autorização de implantação.
