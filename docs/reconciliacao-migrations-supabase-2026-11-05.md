# Etapa 3 — Reconciliação de migrations do Januário Leads

**Auditoria:** 05/11/2026  
**Projeto:** Supabase `czkazbianiflhldenhcj`  
**Base do repositório:** `main@f09cf4c721ddbb4bd6f02cfc9b4596435e9095b4`  
**Escopo:** catálogo, histórico de migrations, baseline reprodutível e estratégia de promoção; **nenhuma escrita ou DDL de produção**.

> **Resultado correto:** o inventário e os hashes históricos estão reconciliados
> com a evidência de produção. O **histórico executável local ainda não está
> reconciliado** para permitir `supabase db push` / `db reset` de forma
> indiscriminada. Essas são metas diferentes. O bloqueio operacional permanece.

## 1. Conferência direta do histórico de produção

| Evidência | Resultado em 05/11/2026 | Interpretação |
| --- | --- | --- |
| Linhas de `supabase_migrations.schema_migrations` | **51** | Fonte autoritativa do registro histórico remoto |
| Arquivos ativos em `supabase/migrations/` | **24** | Todas as versões e nomes correspondem a versões do ledger |
| Migrations existentes apenas no remoto | **27** | Conferem com o manifesto previamente auditado |
| Nome + MD5 dos 27 históricos remotos | **27 de 27 conferem** | Sem drift no inventário que foi registrado em 03/11/2026 |
| SQL histórico arquivado apenas em docs | **15** | Arquivos `.sql.txt`, com aviso `NÃO EXECUTAR` |
| SQL histórico deliberadamente retido somente no remoto | **12** | Dados, permissões, Cron, Vault e testes operacionais sensíveis |
| Migrations locais inexistentes no remoto | **0** | Não justifica reescrever ou reparar o ledger |
| SQL bruto do remoto copiado nesta etapa | **0** | Apenas versões, nomes, contagens de statements e hashes |
| Jobs agendados de sincronização | `sync-leads-daily` **active=false** | Estado confirmado somente por consulta de metadados |

**Limite da conferência:** a comparação dos 24 arquivos ativos foi feita
por **versão e nome**. O MD5 registrado dos 27 históricos remotos foi
comparado ao manifesto anterior. A correspondência de versão dos 24
arquivos **não prova igualdade byte a byte** entre seu SQL local e o
executado historicamente. Tampouco o MD5 representa assinatura confiável
ou comprova que os efeitos da DDL estão presentes hoje. O SQL remoto não
foi reexecutado, lido integralmente ou publicado.

### Arquivo de evidência

`docs/migration-history/ledger-metadata-20261105.json`

Contém somente metadados sanitizados da consulta de leitura: `version`,
`name`, `hash`, `statement_count`, resumo por tabela do catálogo
`public` e sua procedência. Não contém `statements`, dados de
`private_access`, identificadores de clientes, senhas, Vault ou tokens.

O inventário original permanece em:
- `docs/migration-history/expected-remote-only.json`;
- `docs/migration-history-audit.md`;
- `docs/migration-history-review-23.md`.

**Não copiar as 12 SQLs sensíveis para GitHub e não promover as 15
cópias históricas para `supabase/migrations`.** Algumas incluem DML,
configuração de Cron ou backfills cuja reexecução pode mudar dados.

## 2. Comparação estrutural com o baseline

| Categoria do schema `public` | Produção — somente leitura | Baseline — teste descartável |
| --- | ---: | --- |
| Tabelas | 17 | Conferir automaticamente no CI |
| Tabelas com RLS | 17 | Conferir automaticamente no CI |
| Políticas RLS | 38 | Conferir automaticamente no CI |
| Índices | 47 | Conferir automaticamente no CI |
| Funções SQL `public` | 4 | Conferir automaticamente no CI |
| Triggers de usuário | 2 | Conferir automaticamente no CI |

O SQL de teste `supabase/tests/public-schema-inventory-contract.sql`
compara **todas as 17 tabelas por nome**, estado de RLS, quantidade de
políticas e índices por tabela, além das quantidades globais de funções
e triggers. Também compara **hashes dos 257 campos distribuídos entre
as 17 tabelas** (ordem, nomes, tipos, nulabilidade, identidade e geração)
obtidos exclusivamente dos catálogos SQL, sem dados de clientes.
É executado após restaurar o baseline **apenas em PostgreSQL
descartável**. Se detectar divergência, a CI falha fechada.

`scripts/audit_migration_reconciliation.py` faz auditoria **offline**:
histórico local versus inventário remoto congelado, 27 hashes,
15 arquivos de auditoria, 12 retidos e SHA-256 do arquivo
`supabase/baseline/20261103-public.sql` versus seu manifesto original.
Uma mutação futura inesperada da baseline deve interromper a CI.

**Esses testes não equivalem a um diff integral** do SQL ou do estado
do banco. Embora validem assinaturas de nomes, tipos e algumas
propriedades de colunas, não provam igualdade de `DEFAULT`, constraints,
definições das políticas, índices completos, corpos de funções ou
configuração do PostgreSQL. Para afirmar paridade integral será
necessário um diff completo e supervisão em homologação.

### Limites da recuperação

O baseline versionado é apenas do schema `public`. A fixture local
simula papéis e `auth.uid()`, não um Supabase Auth funcional. A
restauração não recupera dados reais, chaves de API, `auth.users`,
configurações de login, Storage, Vault, `pg_cron`, configuração
`sync-leads-daily`, Edge Functions ou seus segredos. Um ambiente
local de PostgreSQL pode validar SQL e regras de acesso, mas não
substitui o contrato de uma instância Supabase real.

## 3. Decisão arquitetural e estratégia de baseline

**Caminho recomendado: baseline de esquema atual em ambiente novo, com
história limpa e explicitamente aprovada; preservar o ledger de produção
intacto.** Isso evita reaplicar históricos de testes, permissões,
Cron e DML sobre o estado atual.

### Produção existente — preservar histórico

1. Considerar o ledger remoto atual a evidência de 51 migrações
   históricas aplicadas. Não excluir, criar entradas artificiais,
   renomear timestamps nem reexecutar SQL para fazer as colunas
   LOCAL/REMOTE parecerem iguais.
2. Manter `scripts/verify-migration-ledger.py --require-clean` como
   bloqueio de deploy indiscriminado. O projeto atual tem **27**
   versões remotas não presentes na pasta ativa; é **intencional**
   que `db push` não seja liberado neste momento.
3. Não colocar o baseline original em `supabase/migrations`
   automaticamente: ele já contém alterações e objetos presentes na
   produção. Aplicá-lo em cima da produção não é estratégia de
   reconciliação.
4. Antes de uma futura alteração de RLS, realizar backup consistente
   (e testar a restauração), diff completo de schema, validação com
   tokens reais em homologação e plano de deploy somente das
   alterações necessárias, sem executar uma fila histórica inteira.
5. Uma futura normalização do ledger deve ser **uma decisão e operação
   supervisionada separada**, com rollback, mapeamento da versão de
   corte, controle de acesso e verificação de que nenhum histórico
   sensível seria reaplicado. Não executar `migration repair` nem
   `db push` remotamente só para eliminar avisos.

### Ambiente novo — reconstrução segura

1. Provisionar um ambiente **isolado e sem dados de clientes**, com
   serviços nativos de Supabase (Auth/Storage/roles) e segredos
   próprios. Não criar instância ou assinatura paga sem autorização.
2. Em um **schema public vazio**, restaurar o baseline
   `20261103-public.sql` **uma vez**, com transações e `ON_ERROR_STOP`;
   não executar 24 migrations antigas **sobre esse snapshot**.
3. Aplicar apenas mudanças posteriores que tenham sido documentadas
   como delta do baseline, incluindo `20261103220000...` se
   necessário. A CI atual executa essa correção duas vezes para
   comprovar idempotência. Verificar o estado final por catálogo e
   RLS.
4. Configurar Auth, Edge Functions, Vault, Cron, Storage, grants e
   demais dependências separadamente, sem copiar credenciais,
   identificadores particulares ou jobs de teste. Confirmar que
   `sync-leads-daily` não é ativado por acidente.
5. **Somente depois** de uma validação de ponta a ponta, decidir um
   novo histórico de migrations para o ambiente limpo, usando a CLI
   atual e uma versão de corte aprovada. Manter os arquivos originais
   preservados como evidência histórica, não como comandos que seriam
   executados.
6. Validar operações de restore e teste funcional de duas contas,
   reautorização e bloqueio de conta revogada; então documentar se
   o novo ambiente realmente reproduz o SaaS.

**Não simular uma reconciliação** acrescentando 27 migrations
vazias. Isso apenas mascara a divergência entre histórico de
execução e origem do código. Tampouco permitir `migration fetch`
de scripts sensíveis sem um processo local isolado para sua guarda.

## 4. Validação por CI e testes de falha segura

Execução no repositório:

```bash
python3 scripts/audit_migration_reconciliation.py
python3 -m unittest discover -s scripts -p "test_migration_reconciliation.py" -v
bash scripts/test-database-baseline.sh
```

Os testes do Python executam sem rede nem ligação com Supabase.
A verificação SQL usa o `postgres:17` descartável já criado
pelo script existente, sem publicar portas, e inclui
`public-schema-inventory-contract.sql` antes dos testes RLS.

O teste negativo bloqueia:
- hashes remotos históricos inesperadamente alterados;
- histórico remoto removido, duplicado ou não classificado;
- migration local nova ou promoção de histórico confidencial;
- perda de arquivo arquivado;
- desativação de RLS no catálogo congelado;
- alteração não autorizada da baseline de esquema.

**Atenção:** o arquivo JSON de ledger é uma fotografia congelada em
05/11/2026. O verificador offline **não detecta alterações ocorridas
após essa data na produção**. Antes de qualquer implantação futura,
é obrigatório comparar o ledger remoto atual por consulta somente
leitura e atualizar a revisão de evidência separadamente; o
`scripts/verify-migration-ledger.py` fornece a checagem online
com token de administração, mas nunca se deve colocar tal token
em arquivos do projeto.

### 4.1. Homologação com Auth e PostgREST reais em Supabase local

**Resultado observado em 05/11/2026:** [CI #42117704596](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/42117704596)
aprovou os três jobs, incluindo **Supabase Auth (GoTrue) e PostgREST
reais**, com dados exclusivamente fictícios. A instância foi criada
temporariamente em um executor do GitHub Actions, com serviços locais
vinculados ao loopback; não foi criado nenhum projeto Supabase Cloud.

O teste automatizado é `scripts/validate_supabase_auth_staging.py`.
Ele restaura o baseline original e aplica a correção `presence_site`,
usa a CLI estável **v2.122.1** no stack local, cria três usuários
fictícios pelo endpoint `/auth/v1/signup` e usa JWTs emitidos pelo
GoTrue em requisições reais a `/rest/v1/`. O SQL de correção de RLS
é obtido por checkout **fixado no commit
`3b5705c0c5055b8ac3ef5b3a5f4833ae812a2c03` da PR #36**,
sem integrar a PR ou modificar produção.

Resultados comprovados pela CI:

1. Contas A e B autorizadas leem apenas seus próprios leads,
   pagamentos e caches; C nunca autorizada não lê nem grava.
2. Com as políticas anteriores, **A revogada ainda lia os próprios
   pagamentos e caches** usando o mesmo JWT real; o defeito foi
   reproduzido em PostgREST, não apenas por `SET ROLE` simulado.
3. Aplicado o SQL candidato somente nesse banco temporário, o mesmo
   JWT de A passou a receber resultados vazios ou negação ao tentar
   ler/gravar os registros protegidos. A conta B não perdeu acesso.
4. O token administrativo local manteve acesso legítimo; um JWT
   inválido foi recusado pelo gateway.
5. A reautorização de A restaurou visibilidade aos mesmos registros
   sem renovar a sessão nem excluir dados.
6. O job executou limpeza dos serviços temporários, sem alterações
   em `czkazbianiflhldenhcj` ou consumo de Google Places/OpenAI.

**Repetição:** a homologação pode ser iniciada pelo job
`supabase-local-auth-staging` do GitHub Actions. O workflow de
teste usa `supabase/setup-cli@v3.2.0` com CLI **2.122.1 fixada**;
a CLI v3 mudou o comportamento de comandos que acessam ambientes
remotos. Para testar uma versão posterior da proposta, revisar
explicitamente o SHA de checkout antes de rodar a CI.

**Limites que continuam:** a homologação real foi local e efêmera;
não provou paridade com as configurações de um projeto **hospedado**
em Cloud Supabase, nem cobriu completamente Storage, Vault, Cron,
Edge Functions, provedores externos, integração com a Vercel ou
restauração de dados de clientes. Ela também não resolveu a
divergência operacional dos 27 históricos remotos.

## 5. Gate para a PR #36 e próximas mudanças de segurança

A PR #36 contém proposta de reforço de revogação RLS ainda em
rascunho, fora das migrations ativas, com testes em PostgreSQL
descartável.

**Não promovê-la automaticamente** enquanto ainda houver 27
migrations remotas não reproduzíveis em um histórico local seguro.
A autenticação e a revogação foram testadas em uma instância real
**local**, mas isso não substitui revisão do histórico executável,
análise de compatibilidade do projeto hospedado e um plano de
implantação autorizado. A criação de migration real deve ocorrer
usando `supabase migration new` com timestamp da própria CLI,
depois da revisão da estratégia de baseline e de uma janela de
mudança aprovada.

O eventual acionamento de produção requer autorização específica,
cópia de segurança e plano de reversão. Este documento **não concede**
tal autorização.

## 6. O que foi e não foi realizado nesta etapa

**Realizado:** consulta somente leitura do ledger, dos nomes e
hashes dos 27 remotos, catálogo do schema `public`, estado do cron;
registro do snapshot sem SQL; CI offline, testes de baseline
descartável, **homologação real e temporária de GoTrue/PostgREST
com três contas fictícias**; decisão técnica e plano de recuperação.

**Não realizado:** alteração de tabelas ou de dados de usuários;
`db push`, `db reset`, `migration repair`, `migration fetch`,
escrita no ledger, secrets, Vault, Cron, deploy de funções,
acesso a dados de clientes, testes com contas de clientes de
produção e criação de infraestrutura hospedada adicional.

## Referências

- [Histórico de migrations, Supabase](https://supabase.com/docs/guides/deployment/database-migrations)
- [Referência da CLI: migration list/fetch/repair](https://supabase.com/docs/reference/cli/supabase-migration-list)
- `docs/database-recovery.md`
- `docs/migration-history-audit.md`
- `docs/migration-history-review-23.md`
- `docs/rls-revocation-rollout-plan-2026-11-05.md` (PR #36, ainda não integrada)
