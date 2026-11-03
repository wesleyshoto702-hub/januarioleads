# Auditoria das 27 migrações históricas não versionadas — 03/11/2026

Este relatório foi gerado a partir do histórico remoto de migrações do projeto
Supabase `czkazbianiflhldenhcj`, comparado com o diretório
`supabase/migrations` da branch `main`.

## Resultado

- **51 migrações** registradas no banco e **24 arquivos** ativos no repositório.
- Todas as 24 versões locais aparecem no ledger remoto.
- **27 versões remotas** não possuem arquivo correspondente no diretório ativo.
- Foram recuperadas **4 cópias de SQL de índices de baixo risco** em
  `docs/migration-history/recovered/*.sql.txt`. Estes arquivos são
  **arquivos históricos**, não migrações executáveis pelo Supabase CLI.
- **23 históricos permanecem sob revisão e sem SQL bruto no GitHub**,
  especialmente os que tratam de cadastro privilegiado, dados, Cron,
  Vault, integrações e/ou permissões. Essa decisão evita registrar
  identificadores particulares ou material de configuração sensível.
- O MD5 é apenas uma referência de integridade para confrontar o
  registro com o ledger remoto; **não autentica a origem nem protege segredos**.

## Inventário de versões ausentes

| Versão | Nome no ledger | Tipo de revisão | Tratamento | MD5 do SQL remoto |
|---|---|---|---|---|
| `20260928194018` | `add_private_access_allowlist` | Estrutura, RLS ou funções | A revisar (não versionar SQL bruto) | `c374eecdf94d8ec906a08b44e629a98a` |
| `20260928195947` | `authorize_private_admin` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `420e93878028dac613332ba98a5691ab` |
| `20260928230154` | `add_lead_sync_backend` | Agendamento HTTP/Cron | A revisar (não versionar SQL bruto) | `7e8eeef37aa719bd9a75d86f78812ba1` |
| `20260928230349` | `schedule_daily_lead_sync` | Agendamento HTTP/Cron | A revisar (não versionar SQL bruto) | `fb4ef0c128e41168f4074e4a50eaec37` |
| `20260928230938` | `add_temporary_sync_validation_job` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `2018b65aa26783ac72bae90dea6a3dd3` |
| `20260928231033` | `remove_temporary_sync_validation_job` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `8ea9a4dde2bf6944f7bf8472a9220a4e` |
| `20260928231037` | `add_temporary_sync_unauthorized_test` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `59699df25c96845014392a65aa9cff16` |
| `20260928231108` | `remove_temporary_sync_unauthorized_test` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `e68154883c00a12bb1a679c845de63db` |
| `20260928231207` | `add_temporary_lead_sync_validation_row` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `da45d3b88928ffce9023f4a5b7867bde` |
| `20260928231211` | `add_temporary_lead_sync_google_test_job` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `f34c2afb8930b325766f680ad5834d30` |
| `20260928231556` | `remove_temporary_google_sync_validation` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `ef1bd60923e836fb43f90d9115dc608b` |
| `20260928231750` | `validate_localized_sync_once` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `6bbe61fe3608a4ea02f79b306a701b16` |
| `20260928231816` | `remove_localized_sync_validation_row` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `0576694fe10ce5e88f35bfead77a517e` |
| `20260928232104` | `validate_partial_sync_failure_once` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `2cf5f86249485549ded0f1ba99414cd8` |
| `20260928232137` | `remove_partial_sync_validation_rows` | Operação histórica/temporária | A revisar (não versionar SQL bruto) | `ab642860d16408d2985f0b89ab7b6711` |
| `20260929014729` | `add_site_preview_cache` | Operações de dados | A revisar (não versionar SQL bruto) | `613d1366a7c104a0de8b202df406afb1` |
| `20260929020122` | `remove_redundant_site_preview_index` | Índices | SQL arquivado (somente leitura) | `0695c4a81968ee149aa6e724da1df03b` |
| `20260929023342` | `add_lead_activity_history` | Operações de dados | A revisar (não versionar SQL bruto) | `5460eb63ed051b0077e9650b1241c873` |
| `20260929023857` | `constrain_and_backfill_lead_activities` | Operações de dados | A revisar (não versionar SQL bruto) | `16a244c9d99a000d043e1232dd18023a` |
| `20260929024005` | `auto_record_lead_added_activity` | Operações de dados | A revisar (não versionar SQL bruto) | `cc4ecaf04ed9d9fd295479ec42c2e0d4` |
| `20260929024235` | `harden_lead_activity_policies_and_index` | Operações de dados | A revisar (não versionar SQL bruto) | `df61390fa5c0c20c170c00d32f6c1035` |
| `20260929024849` | `restrict_lead_activity_trigger_function` | Estrutura, RLS ou funções | A revisar (não versionar SQL bruto) | `b84ad5e758f636458dd23c159b38e696` |
| `20260929120540` | `add_prompt_visual_references` | Operações de dados | A revisar (não versionar SQL bruto) | `f79a354cdb8e09462acba30e296e6d8f` |
| `20260929122000` | `index_prompt_visual_reference_user` | Índices | SQL arquivado (somente leitura) | `fb602df2e5d25ef66848394692cb4d82` |
| `20260929123306` | `remove_redundant_visual_reference_indexes` | Índices | SQL arquivado (somente leitura) | `4ca08204a369d52c9f773d0df666302e` |
| `20260929164500` | `add_url_visual_reference_capture` | Operações de dados | A revisar (não versionar SQL bruto) | `46e806f3a3a68bbb9672f3cf3452a052` |
| `20260929164819` | `remove_redundant_visual_reference_asset_index` | Índices | SQL arquivado (somente leitura) | `898ee2810784324256f666590f2a8c40` |

## Cuidados operacionais

1. **Não fazer `supabase db push` ou `db reset` remoto** até conciliar o
   histórico completo e estabelecer uma estratégia de baseline replicável.
   Nunca reaplicar os testes temporários ou registros de autorização em produção.
2. As quatro cópias de índice preservam o SQL de forma fiel, mas o diretório
   `docs/` foi escolhido de propósito para não fazer a CLI executá-las.
3. Inspecionar os outros 23 scripts um por um em ambiente seguro; confirmar
   se contêm dados particulares e redesenhar o procedimento de restauração
   sem voltar a executar as operações históricas.
4. Não adicionar registros artificiais ao ledger, não sobrescrever a baseline
   original e não alterar as 197 empresas/leads de produção.
5. Antes de fazer nova migração de estrutura, revisar
   `supabase migration list --linked`, realizar backup, testar a reconstrução
   em homologação e avaliar `supabase db push --dry-run`.

A recuperação **parcial de 4 arquivos** não significa que a reconciliação das
27 versões está concluída. O inventário está completo; a recuperação operacional
permanece parcial.
