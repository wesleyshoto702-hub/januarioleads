# Januário Leads — auditoria integrada GitHub + Supabase (06/11/2026)

**Escopo:** inventário, segurança, recuperação, CI e divergências de código em relação ao Supabase de produção. Leituras de metadados e código apenas; sem acessar registros individuais, sem exportar clientes, sem DDL ou cobrança.

## Estado confirmado em 06/11/2026

| Item | Resultado |
| --- | --- |
| Repositório | `wesleyshoto702-hub/januarioleads` (privado), branch `main` |
| Commit de referência | `d12d120c16bd01d6b0aa2779b1037d14cb54aa86` (PR #45) |
| CI do commit | `42205460645` (todos os jobs executados passaram; o job de Auth local está configurado para ser ignorado nessa modalidade) |
| Supabase | `czkazbianiflhldenhcj`, `ACTIVE_HEALTHY`, PostgreSQL 17 |
| Tabelas públicas | 17 / 17 com RLS |
| Políticas RLS | 38 em `public`; 7 nas quatro tabelas de revogação |
| SECURITY DEFINER publicamente executável por anon/authenticated | 0 |
| Políticas críticas com predicado explícito de membership em private_access | 0 |
| Migrations remotas | 51 |
| Migrations locais executáveis | 24 |
| Divergência de histórico | 27 versões somente no ledger remoto |
| Edge Functions ativas hospedadas | 8 |
| Pastas Edge Functions no repositório | 4 |
| Supabase Security Advisor | Avisos: `pg_net` no schema public; proteção de senhas vazadas desativada |
| Supabase Performance Advisor | 5 FKs sem índice de cobertura; 4 índices marcados como não utilizados (revisar carga antes de agir) |

As contagens de objetos provêm de metadados, não de consulta às linhas de clientes. O uso de `verify_jwt=false` em `sync-leads` é acompanhado de validação de segredo próprio `x-sync-secret` por hash no código; essa configuração merece testes de regressão em ambiente isolado, não deve ser simplesmente trocada para `true` sem revisar o agendamento.

## Bloqueios obrigatórios

1. **PR #36, revogação de acesso:** a conta removida de `private_access` ainda pode acessar seus próprios dados em políticas específicas enquanto tem JWT válido. RLS ativo não resolve esse caso. Correção proposta segue rascunho, sem DDL em produção.
2. **Backup recuperável:** exportador e restaurador local preparados; nenhum backup SQL real restaurado e validado com evidência nesta auditoria. O plano Free não fornece backup diário automático. Não fazer dump de clientes em CI, GitHub, chat ou computador externo.
3. **Isolamento da restauração:** a PR #45 adicionou modo de preparar laboratório vazio com rede que permite tráfego de saída; esse modo **não** pode receber dados reais. Esta PR reforça o restaurador para exigir rede Docker interna exclusiva `januario-restore-local`, container pertencente ao laboratório e somente porta local. Até comprovar que esse modo funciona no Windows, a restauração de dados reais permanece bloqueada.
4. **Migrations:** não usar `db push`, `db reset`, `migration repair` ou replay de scripts históricos no remoto. A divergência do ledger impede o fluxo habitual de promoção.
5. **Cobertura de recuperação Edge Functions:** `search-places`, `sync-leads`, `deep-enrich-business` e `open-now-niches` estão versionadas; `generate-site-prompt`, `generate-preview`, `analyze-visual-references` e `capture-visual-reference` estão ativas no Supabase, mas sem pastas de código correspondentes no repo. Isso não prova perda de código, mas indica **lacuna de versionamento e recuperação**. Revisar fontes implantadas em canal privado, verificar se há segredos embutidos, e adicionar ao repositório apenas versões sanitizadas e aprovadas, com testes. Nenhum deploy automático.
6. **Avisos secundários:** analisar dependências de `pg_net` antes de mover extensão; proteção de senhas vazadas pode depender das opções de plano. As 5 FKs sem índice podem afetar performance, mas criar índices ou remover os 4 índices nunca usados requer medições e aprovação.

## Plano de continuação

- **P0:** CI e revisão do endurecimento de rede interna no restaurador (esta PR), sem conexão a dados reais.
- **P0:** proprietário preparar ambiente Windows criptografado, concluir exportação local e comprovar restauração em rede Docker interna, seguida de validação funcional Auth/PostgREST e cópia criptografada adicional.
- **P0:** estratégia auditada para implantar apenas o delta RLS da PR #36, sem repetir 27 migrations remotas. Novo preflight, backup restaurável e autorização específica para DDL.
- **P1:** inventariar as 4 Edge Functions ativas sem fonte no repositório, com plano seguro de recuperação. Checar se versões publicadas correspondem ao código versionado das outras 4, sem exibir segredos.
- **P1:** corrigir avisos de segurança secundários de forma isolada e testada; avaliar FKs sem índice com a carga real.
- **P2:** analisar PR #27 de UX separadamente, sem misturar com correções de banco. Cadastro comercial e assinaturas ainda não fazem parte do MVP público.

## Evidência e referências

- PRs #36, #37, #38, #39, #40, #42, #43, #44, #45; issue #41.
- `docs/rls-release-readiness-2026-11-05.md`
- `docs/reconciliacao-migrations-supabase-2026-11-05.md`
- `docs/inicializacao-privada-windows.md`
- `docs/restauracao-privada-local-supabase-2026-11-05.md`
- [Backups Supabase](https://supabase.com/docs/guides/platform/backups)
- [Database linter Supabase](https://supabase.com/docs/guides/database/database-linter)

**Conclusão:** esta auditoria não aprova o release RLS, não comprova backup restaurável e não altera dados de produção.