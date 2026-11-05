# Plano de implantação controlada — revogação de acesso RLS

Data de revisão: 05/11/2026  
Base de código: `main` @ `f09cf4c721ddbb4bd6f02cfc9b4596435e9095b4`  
Estado: **candidato preparado e testado apenas em PostgreSQL descartável; NÃO implantado**.

## Problema comprovado por metadados em produção

Nas políticas de `lead_payments` (SELECT), `places_search_cache`
(SELECT/INSERT/UPDATE) e `open_now_niche_cache` (SELECT) o PostgreSQL
verifica `auth.uid() = user_id`, mas **não** a entrada ativa do usuário na
tabela `private_access`. As grants do papel `authenticated` permitem
essas operações e a política não é executada pelo frontend sozinho.
Portanto, ao remover um usuário de `private_access`, um JWT não expirado
ainda pode acessar **registros do próprio usuário** dessas três tabelas.
Isto **não** demonstra acesso cruzado a dados de outro usuário.

Políticas de `leads` e `lead_activities` já aplicam checagem de acesso.
`lead_payments` INSERT exige um `lead_id` do próprio usuário através de
`leads` (que já é protegida); esta proposta não altera essa política de
INSERT, mas seus testes devem confirmar que a revogação não a contorna.

Tabelas relevantes possuem RLS ativada. `private_access.user_id` tem
índice PK; as três tabelas têm índices por `user_id`. Não precisamos
introduzir índices adicionais neste incremento.

## Regras de segurança e orçamento

- Não copiar/exportar registros de clientes, auth.users ou secrets.
- Não usar a conexão de produção para testes de escrita, revogação ou
  `SET ROLE`; todos os cenários atuais usam UUIDs fictícios em PostgreSQL
  descartável, restaurado de baseline sem dados de clientes.
- Não desativar RLS nem alterar papéis/GRANTs/privileged functions.
- Não publicar no Supabase e não executar `db push`, `db reset`,
  `migration repair` ou alterações no ledger remoto.
- Não criar projeto Supabase de homologação com cobrança sem acordo prévio.
- Não fazer merge automático só porque a CI ficou verde.

## SQL candidato e rollback

**Aplicação transacional proposta (revisão obrigatória):**
`docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt`

**Rollback de emergência (reabre a lacuna):**
`docs/proposals/private-access-revocation-rollback-2026-11-05.sql.txt`

A alteração usa `BEGIN/COMMIT` e recria cinco políticas sob os mesmos nomes,
em uma transação. O preflight exige o inventário estável das seis políticas
originais do conjunto de tabelas (cinco alteradas e o INSERT de pagamentos
inalterado), RLS ligado nas quatro tabelas envolvidas e `lock_timeout=5s`,
`statement_timeout=30s`. Se detectar diferença, deve falhar sem persistir
DDL. O rollback NÃO deve ser a opção padrão em caso de erro, pois torna
possível novamente o acesso após revogação; qualquer decisão de emergência
precisa de aprovação explícita e mitigação alternativa.

**Os scripts `.sql.txt` NÃO são migrations executadas automaticamente.**
Não copiar para `supabase/migrations/` enquanto o ledger local/remoto não
tiver uma estratégia de reconciliação validada.

## Baseline e estado de migrações

No momento da auditoria, a conexão de leitura confirmou **51 versões**
no ledger remoto, **24 migrations** na pasta de trabalho da `main` e
**27 versões históricas somente no remoto**. O
`scripts/verify-migration-ledger.py` verifica e BLOQUEIA versões locais
não aplicadas; não vamos enfraquecer nem alterar esse controle para fazer
um deploy passar.

Conforme `docs/database-recovery.md`, o snapshot
`supabase/baseline/20261103-public.sql` não deve ser restaurado sobre
produção; contém somente o schema public, com fixture de Auth fictícia
exclusiva dos testes.

### Promoção para migration versionada (APENAS após conciliação)

1. Revisar o backup/restore, o ledger remoto e executar dry-run da CLI em
   **ambiente isolado**, nunca usar `db push` para contornar a divergência.
2. Em um checkout seguro com Supabase CLI instalada, verificada por
   `supabase --version`, `supabase migration --help` e
   `supabase migration new --help`, executar
   `supabase migration new require_private_access_for_tenant_data`.
3. Copiar o SQL **revisado** do arquivo candidato para a migration
   recém-gerada, mantendo o timestamp emitido pela CLI (não inventar
   versões, não editar o ledger à mão).
4. Testar novamente no PostgreSQL 17 descartável e, se disponível sem
   custos extras, no ambiente de homologação Supabase com dois usuários
   fictícios, tokens reais e chamadas PostgREST.
5. Rodar `supabase migration list --linked` e
   `supabase db push --dry-run` **somente após** conciliar o histórico.
   Comparar os nomes das políticas, RLS e GRANTs de produção via SQL
   somente leitura antes de qualquer implantação.
6. Aprovar janela de mudança, backup, operação de publicação e retorno.
   Só depois executar o processo autorizado e conferir as políticas
   por leitura, sem revelar clientes ou tokens.

A CLI do Supabase não estava instalada no ambiente de análise desta etapa,
e o registro npm ficou inacessível; por isso **não foi gerado um arquivo
de migration com timestamp pela CLI**. A preparação ficou isolada como
candidato SQL, preservando o controle de migrações existentes.

## Matriz de testes em CI (não é teste PostgREST real)

Execução: `bash scripts/test-database-baseline.sh` cria um container
`postgres:17` descartável e o remove automaticamente ao fim.

1. Restaura baseline + fixtures fictícias + migração de correção
   `presence_site` já versionada; executa testes de isolamento existentes.
2. `supabase/tests/private-access-revocation-before.sql` demonstra, na
   estrutura original, que A revogado consegue ler/editar os próprios caches.
3. Aplica o SQL candidato e executa
   `supabase/tests/private-access-revocation-proposal.sql`.
4. Verifica duas contas autorizadas A/B, isolamento cruzado, SELECT/INSERT/
   UPDATE próprios, conta jamais autorizada, revogação de A com JWT ainda
   mapeado por `auth.uid()`, preservação de B, reautorização de A com dados
   originais e manutenção `service_role`.
5. Restaura cinco políticas originais via rollback, reproduz a lacuna antiga
   no banco descartável e reaplica/retesta a correção.
6. Testa que uma falha de preflight não altera políticas (opcional em
   futura ampliação do conjunto, se necessário).

**Limites:** o fixture simula `auth.uid()` com claim de sessão, não
autentica JWT de verdade, não exercita GoTrue/PostgREST e não cobre ataques
de concorrência. Aprovação de testes SQL é necessária, não suficiente,
para publicar o patch.

## Pontos de verificação após futura implantação autorizada

- Confirmar `pg_policies` para as cinco políticas e nenhuma nova
  política permissiva ampla nas mesmas tabelas.
- Confirmar `relrowsecurity=true` em todas as tabelas do conjunto.
- A/B em ambiente de homologação: usuários autorizados acessam só próprios
  dados; revoque A sem apagar o usuário, confirme bloqueio com o token
  ainda válido e B sem interrupção.
- Reautorizar A e confirmar preservação de pagamentos/caches.
- Confirmar `service_role` não sofreu regressão nem grants adicionais.
- Revisar logs para erros inesperados; nenhuma chave/tabela deve aparecer
  em logs públicos.
- Documentar hash e versão da migration aplicada, com histórico consistente.

## Referências

- `docs/database-recovery.md`
- `docs/auditoria-inicial-2026-11-05.md`
- `scripts/verify-migration-ledger.py`
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/deployment/database-migrations
