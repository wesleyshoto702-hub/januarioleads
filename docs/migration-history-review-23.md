# Revisão individual dos 23 scripts históricos — 03/11/2026

## Escopo e integridade

Os 23 históricos faltantes foram lidos **individualmente** no ledger
`supabase_migrations.schema_migrations` do projeto
`czkazbianiflhldenhcj`. Esta leitura não executou nenhum SQL contido
nesses históricos, nem mudou tabelas, contas ou dados.

- **11 scripts** sem identificadores privados, endpoints, Vault ou segredos
  foram recuperados como arquivos de texto com SQL integral, exclusivamente
  em `docs/migration-history/recovered/*.sql.txt`. Estes arquivos
  **NÃO são migrações ativas**, nunca executá-los em produção.
  Dois desses scripts encerram jobs temporários de Cron;
  outros contêm DML de backfill ou funções e não devem ser reaplicados.
- **12 scripts** abrangem permissões de usuário, dados temporários de
  validação e/ou agendamentos Cron/Vault. O SQL integral foi preservado
  **somente no histórico remoto**, sem copiar valores ao repositório.
  Este arquivo contém a classificação e hash, não os dados secretos.
- Os **4 scripts anteriores** de índices permanecem recuperados no
  mesmo diretório, totalizando **15 SQLs originais arquivados** e **12
  registros de retenção segura no ledger** dentre as 27 versões remotas.
- As versões, nomes e hashes MD5 abaixo foram obtidos diretamente do
  Supabase. MD5 serve apenas para checagem de correspondência, não como
  assinatura criptográfica ou proteção de segredos.

## Revisão por versão

| Versão | Nome | Desfecho | Justificativa | MD5 original |
|---|---|---|---|---|
| `20260928194018` | `add_private_access_allowlist` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `c374eecdf94d8ec906a08b44e629a98a` |
| `20260928195947` | `authorize_private_admin` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Insere autorização de usuário; pode incluir identificador pessoal. Não reproduzir. | `420e93878028dac613332ba98a5691ab` |
| `20260928230154` | `add_lead_sync_backend` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Estrutura de sync integrada a Vault, triggers e jobs; preservar no ledger remoto e baseline validada. | `7e8eeef37aa719bd9a75d86f78812ba1` |
| `20260928230349` | `schedule_daily_lead_sync` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Agenda Cron com Vault; depende de configuração de produção. | `fb4ef0c128e41168f4074e4a50eaec37` |
| `20260928230938` | `add_temporary_sync_validation_job` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Agenda teste temporário de sync com dependências Vault. | `2018b65aa26783ac72bae90dea6a3dd3` |
| `20260928231033` | `remove_temporary_sync_validation_job` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `8ea9a4dde2bf6944f7bf8472a9220a4e` |
| `20260928231037` | `add_temporary_sync_unauthorized_test` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Agenda teste temporário de autenticação não autorizada/HTTP. | `59699df25c96845014392a65aa9cff16` |
| `20260928231108` | `remove_temporary_sync_unauthorized_test` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `e68154883c00a12bb1a679c845de63db` |
| `20260928231207` | `add_temporary_lead_sync_validation_row` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Insere lead temporário de teste associado a conta. | `da45d3b88928ffce9023f4a5b7867bde` |
| `20260928231211` | `add_temporary_lead_sync_google_test_job` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Agenda teste temporário de integração Google/Vault. | `f34c2afb8930b325766f680ad5834d30` |
| `20260928231556` | `remove_temporary_google_sync_validation` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Remove teste via Cron e exclusão de lead de validação. | `ef1bd60923e836fb43f90d9115dc608b` |
| `20260928231750` | `validate_localized_sync_once` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Insere lead temporário para testar sync localizado/Vault. | `6bbe61fe3608a4ea02f79b306a701b16` |
| `20260928231816` | `remove_localized_sync_validation_row` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Remove lead temporário de validação. | `0576694fe10ce5e88f35bfead77a517e` |
| `20260928232104` | `validate_partial_sync_failure_once` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Insere leads temporários e teste de falha parcial com Vault. | `2cf5f86249485549ded0f1ba99414cd8` |
| `20260928232137` | `remove_partial_sync_validation_rows` | SQL original mantido apenas no ledger (dados, Cron ou Vault) | Remove leads temporários de testes de falha parcial. | `ab642860d16408d2985f0b89ab7b6711` |
| `20260929014729` | `add_site_preview_cache` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `613d1366a7c104a0de8b202df406afb1` |
| `20260929023342` | `add_lead_activity_history` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `5460eb63ed051b0077e9650b1241c873` |
| `20260929023857` | `constrain_and_backfill_lead_activities` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `16a244c9d99a000d043e1232dd18023a` |
| `20260929024005` | `auto_record_lead_added_activity` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `cc4ecaf04ed9d9fd295479ec42c2e0d4` |
| `20260929024235` | `harden_lead_activity_policies_and_index` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `df61390fa5c0c20c170c00d32f6c1035` |
| `20260929024849` | `restrict_lead_activity_trigger_function` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `b84ad5e758f636458dd23c159b38e696` |
| `20260929120540` | `add_prompt_visual_references` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `f79a354cdb8e09462acba30e296e6d8f` |
| `20260929164500` | `add_url_visual_reference_capture` | SQL integral recuperado em docs (NÃO EXECUTAR) | Arquivo histórico não executável | `46e806f3a3a68bbb9672f3cf3452a052` |

## Estratégia para restauração e futuras migrações

**Produção não será redefinida para tornar o histórico visualmente simétrico.**
Os 51 registros remotos continuam sendo a fonte autoritativa da execução
histórica, inclusive os testes temporários. O diretório
`supabase/migrations` possui 24 scripts ativos que já constam no remoto.
O snapshot `supabase/baseline/20261103-public.sql` é um baseline estrutural
e foi validado em banco PostgreSQL descartável; ele não contém Auth,
credenciais, Vault, Cron, Storage ou dados de produção.

O procedimento seguro para um **novo ambiente** é provisionar os serviços
Supabase, restaurar o schema public da baseline validada apenas uma vez em
schema vazio, provisionar manualmente Auth/Vault/Cron com segredos novos,
e estabelecer uma linha de histórico consistente de forma supervisionada.
Não reaplicar os históricos originais de autorização de administradores,
testes Cron ou dados temporários. Validar isolamento e políticas RLS antes
de liberar acesso a clientes.

Para **produção existente**, continuar fazendo novas mudanças por migrações
revisadas, após backup e prévia de diferenças em homologação. O
`supabase migration list --linked` continuará evidenciando as 27 versões
remotas que não estão na pasta executável. Não executar
`supabase db push` **nem** `supabase db reset` contra o projeto atual
até que um plano de baseline e restauração, com validação real,
seja aprovado e implementado. Não inserir migrações vazias apenas para
eliminar alertas de versão.

A revisão e classificação dos 23 itens **está concluída**. O alinhamento
operacional dos históricos para permitir `db push` automatizado **não
está concluído**; são objetivos diferentes.
