# Januário Leads — Fase 0: proteção de credenciais, baseline e backup

**Início:** 15/11/2026 (18h BRT)  
**Status:** EM EXECUÇÃO. **Nenhum backup foi criado nem restauração comprovada por este relatório.**  
**Ambientes:** PRODUÇÃO `czkazbianiflhldenhcj`; HOMOLOGAÇÃO `prlrxjothrslhswpkoza`.  
**Fonte única do roadmap:** [Plano Mestre](PLANO-MESTRE-JANUARIO-LEADS.md).

## 0.1 Credencial `service_role` comprometida — BLOQUEIO P0

Um token legado `service_role` de HOMOLOGAÇÃO foi colado anteriormente como código numa célula Colab e em uma mensagem do chat. **Trate como comprometido.** Não existe ferramenta conectada que permita, neste ambiente, verificar ou efetuar a revogação de chaves `service_role` legadas. A revisão de publishable keys **NÃO** comprova revogação de chaves de serviço.

- [x] Identificar projeto correto: `prlrxjothrslhswpkoza`; **não** alterar produção por causa desse incidente.
- [x] Verificar que chave publicável moderna está presente e ativa. Isso **não** revoga `service_role`.
- [x] Mapear código `search-places` na HOMOLOGAÇÃO: hoje `adminConfig()` **prioriza** `SUPABASE_SERVICE_ROLE_KEY` antes de `SUPABASE_SECRET_KEYS`, um impedimento importante à migração. `staging-plan-preview` também possui referências a ambas as formas.
- [ ] No Dashboard de homologação, conferir/criar nova `sb_secret_...` para backend (não compartilhar o valor).
- [x] Preparar e testar offline o seletor de `sb_secret_` moderno: [PR #159](https://github.com/wesleyshoto702-hub/januarioleads/pull/159) integrada, função `search-places` da homologação publicada na **versão 31 (ACTIVE)**. JWT de usuários continua exigido; base Overture preservada.
- [ ] Testar busca ponta a ponta com usuário autenticado; validar `staging-plan-preview`, Colab e consumidores legados antes de revogar a chave antiga. CI isolado e deploy ACTIVE não comprovam E2E.
- [ ] Conferir GitHub Actions, Colab, workers e webhooks: nenhum deve depender da chave antiga.
- [ ] Desativar a chave legada no Supabase Dashboard e confirmar o status **desativado**; verificar a aplicação e observar erros. Não presumir que criar a nova chave invalida a antiga. Rotação de chaves de assinatura JWT é um trabalho distinto: não executar indiscriminadamente.
- [ ] Conferir se a sessão antiga do Colab foi desconectada e se o notebook usa campo oculto.
- [ ] Marcar 0.1 concluída **somente** após evidência de chave antiga desativada, nova credencial ativa e fluxos testados.

**Verificação adicional:** PR #158 (script de backup criptografado) e PR #159 (seletor moderno primeiro) integradas em `main`; GitHub Actions verde. Somente homologação recebeu função v31; produção mantém `search-places` versão 34, sem alterações. Rotação/revogação antiga ainda não confirmada.

**Referência oficial:** https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys

## 0.2 Backup e restauração — BLOQUEIO P0

### Fatos reais em PRODUÇÃO — consulta apenas leitura
- Supabase organização `chave`: **plano Free**. O Supabase documenta backups automáticos diários para Pro/Team/Enterprise; no Free, o procedimento **manual** é necessário.
- Projeto de produção está `ACTIVE_HEALTHY`; tamanho reportado pelo PostgreSQL: **22 MB**.
- **212 leads** no CRM, **2 contas Auth**, **259 atividades**, **8.946 atualizações**, **0 pagamentos de leads**, **2 registros de toque**, **1 configuração de usuário**, **2 acessos privados**, **64 itens em cache de pesquisa**, **6 documentos comerciais**.
- Supabase Storage: **1 bucket e 9 objetos**; Auth: **3 identidades**, **9 sessões**; existem **5 prévias de sites**. *Autenticação e arquivos também importam para recuperação.*
- Relacionamentos principais sem órfãos: **0 leads sem proprietário**, **0 leads de usuários inexistentes**, **0 leads sem registro de acesso**, **0 atividades/atualizações/pagamentos apontando para leads inexistentes**.

### Execução local protegida (Windows)
O script `scripts/fase0-backup-producao.ps1` foi preparado, mas **ainda não foi executado** (não há acesso pela ferramenta de backup/restauração de banco nem à senha do projeto, o que é deliberadamente seguro).

1. Instalar cliente PostgreSQL 17 (`pg_dump`, `pg_restore`) e GnuPG (`gpg`) no computador; recomenda-se disco local criptografado (ex. BitLocker), pois o dump temporário existe brevemente em texto claro até a criptografia.
2. Abrir PowerShell a partir da raiz do repositório e executar:
   `powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Check`
3. Em **Supabase Produção > Connect > Session Pooler**, copiar **host sem URL/senha** e usuário de conexão. Não colar credenciais neste chat, em notebooks ou no GitHub.
4. Executar:
   `powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Backup`
5. Informar host/usuário, confirmar `BACKUP_PRODUCAO` e digitar senha de banco **no prompt oculto**. GnuPG pedirá uma **outra senha forte** para criptografar o arquivo, guardada fora do computador.
6. O script realiza `pg_dump` dos schemas `public`, `auth`, `storage` em formato custom, confere formato com `pg_restore --list`, criptografa o arquivo em GPG AES-256 e valida descriptografia/leitura do índice. Remove os dumps temporários em `finally`.
7. Guardar a saída `.dump.gpg` e o manifesto `.json` em armazenamento privado e cópia offline. **Não** enviar para GitHub, Lovable, chat ou e-mail. Confirmar se o bucket contém arquivos que precisam ser baixados separadamente.
8. **Falta um teste real de RESTAURAÇÃO em banco isolado**, com verificação de contagens, usuários, permissões e arquivos. `pg_restore --list` **não é** teste de restauração. Só marcar concluído após esse teste, com custo de eventual projeto temporário aprovado.

**Limitações do script:**
- Backup lógico dos schemas `public`, `auth`, `storage`, mas **não inclui bytes de objetos Storage**, segredos Edge, roles globais, nem toda configuração do projeto.
- Usa senha de conexão PostgreSQL, **não** a chave `service_role`.
- O arquivo cifrado é portátil, porém a senha GPG é indispensável para recuperação; não confiar só numa cópia local.
- Conexão de sessão pode falhar se o host estiver incorreto ou rede restrita; não reduzir TLS para contornar.
- Não modificar produção apenas para testar backup.

**Referências:**  
https://supabase.com/docs/guides/platform/backups  
https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

## 0.3 Estado de segurança e integridade verificado — parcialmente concluído
- [x] Produção e homologação identificadas, ambas saudáveis.
- [x] **20 tabelas públicas de produção**: 20 com RLS habilitado; **0 com SELECT ou INSERT direto para papel `anon`**.
- [x] Políticas `leads` restringem `SELECT/INSERT/UPDATE/DELETE` a `user_id=auth.uid()` mais acesso privado; `lead_activities` valida dono e existência do lead. `user_settings` e documentos têm políticas por proprietário.
- [x] Duas funções `SECURITY DEFINER` em `public`: `claim_api_request_for_user`, `claim_open_now_refresh`; não concedem `EXECUTE` diretamente aos papéis `anon` ou `authenticated` conforme leitura de privilégios.
- [x] A rotina `sync-leads` de produção usa `verify_jwt=false` **com segredo próprio `x-sync-secret` validado por hash**, e também bloqueio de gasto Google por padrão, conforme leitura do código. O fato de `verify_jwt=false` sozinho **não** significa rota aberta; testar falhas/segredo inválido mais adiante.
- [ ] Executar teste negativo real de isolamento entre dois usuários autenticados e endpoints de função; a leitura de políticas **não o substitui**.
- [ ] Registrar/validar plano de rollback para cada release de Edge Functions e frontend.
- [ ] Auditar políticas de `storage.objects` e arquivos, snapshots e segurança do link de acesso.

### Avisos atuais do Supabase Advisor
- **Produção:** `auth_leaked_password_protection` (WARN) e `extension_in_public` (WARN). Não ativar nem mover extensões sem validar dependências.
- **Homologação:** `auth_leaked_password_protection` (WARN); 16 casos informativos `rls_enabled_no_policy` em tabelas administrativas sem acesso público esperado.
- **Desempenho:** 5 FKs sem índice na produção (INFO); **não** alterar índices antes de testes/backup.

Consultar:
- https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

## 0.4 / 0.5 Custos e limites de provedores — leitura inicial
- [x] A função de busca tem guardião de orçamento: Google exige aprovação explícita, limites de chamadas e reserva no banco; Geoapify também tem limites e concessões de orçamento (código).
- [x] `sync-leads` está projetada para falhar sem habilitação explícita e sem aprovação de gasto Google.
- [ ] Confirmar **segredos e limites efetivos** de cada ambiente; o código estar seguro por padrão não comprova configuração real.
- [ ] Verificar painel de Usage/Faturas de Supabase, Google Cloud e Geoapify (não acessíveis por este diagnóstico).
- [ ] Formalizar limite total de custo e alertas antes do beta.

## 0.6 Plano de continuação e portão para Fase 1

| Item | Resultado | Pode marcar concluído? |
|---|---|---|
| 0.1 Identificar exposição e dependências | **Mapeado** | Não: revogação não confirmada |
| 0.2 Backup real | **Script preparado** | Não: dump e restauração ainda não executados |
| 0.3 Inventário do banco e RLS | **Auditoria somente leitura concluída** | Parcial: testes reais pendentes |
| 0.4 Autenticação e separação de contas | **Políticas favoráveis** | Não: testes reais pendentes |
| 0.5 Provedores e contas | **Guardas no código verificados** | Não: limites efetivos pendentes |

**Próxima ação única:** executar a substituição segura da credencial na HOMOLOGAÇÃO, primeiro revisando os consumidores `SUPABASE_SERVICE_ROLE_KEY` e preparando a precedência da nova chave. Não desativar a antiga enquanto os consumidores não forem testados. Em paralelo, executar backup protegido LOCAL com o script, sem enviar dados para o repositório.

**Nunca declarar Fase 0 concluída enquanto chave exposta ou backup/restore não estiverem comprovados.**


## Atualização de execução — 16/11/2026 (retomada solicitada)

**Status: FASE 0 EM EXECUÇÃO, AINDA BLOQUEADORA.** Auditoria realizada por acesso somente de leitura aos dois projetos. Nenhuma chave foi revogada, nenhum backup foi produzido ou restaurado, nenhuma migration foi executada e nenhum registro de cliente foi alterado nesta atualização.

### Evidência observada (16/11/2026)

| Métrica | Produção | Homologação |
|---|---:|---:|
| Ref Supabase | `czkazbianiflhldenhcj` | `prlrxjothrslhswpkoza` |
| Banco, bytes (no momento da consulta) | 22.809.747 | 191.633.075 |
| Tabelas base públicas | 20 | 43 |
| Tabelas públicas com RLS | 20 | 43 |
| Policies públicas | 46 | 56 |
| Migrações aplicadas no Supabase | 63 | 57 |
| Contas em Auth | 2 | 1 |
| Leads CRM | 212 | não conferido |
| Atividades CRM | 259 | não conferido |
| Storage | 1 bucket / 9 objetos | não conferido |

- As **63/57 versões remotas** evidenciam que o script histórico `scripts/audit_migration_reconciliation.py` (ledger fixo de 51 versões da produção e 24 migrações locais) não pode ser usado para afirmar sincronização atual. Revisar a reconciliação sob novo snapshot e sem executar ou excluir migrações; preservar baseline histórico imutável.
- Produção: `anon` tem **0 grants diretos SELECT/INSERT** no schema `public` (teste apenas de privilégios da tabela; não substitui teste HTTP negativo ou revisão de functions). A homologação possui grants de tabela, mas RLS está habilitado em todas as 43 tabelas base, portanto a exposição efetiva deve ser verificada por policies e testes com tokens próprios; não confundir grants com linhas acessíveis.
- Os avisos ativos de segurança **não foram corrigidos**, apenas confirmados: proteção contra senhas vazadas desligada em ambos; extensão `pg_net` em `public` na produção; avisos informativos de RLS sem policy em tabelas administrativas de staging.
- Chave pública moderna `sb_publishable_` de staging presente e ativa. **Isso não prova revogação da antiga `service_role`**. `search-places` v31 e `staging-plan-preview` v6 ainda referenciam caminhos de chave de serviço (nova/legada); verificar todos os consumidores antes do corte. O conector disponível não administra as chaves secretas/legadas: intervenção no Dashboard é necessária.
- Nenhuma leitura de valores secretos, credenciais pessoais ou conteúdo de leads foi necessária.

### Sequência exata para encerrar os portões, sem perder dados

1. **0.1 — credencial de staging:** interromper/desconectar todas as Colabs e jobs de importação; no Dashboard **somente de HOMOLOGAÇÃO**, verificar nova `sb_secret_` no menu de API keys; revisar todos os consumidores autorizados, inclusive scripts/Colab, `search-places`, `staging-plan-preview`, funções auxiliares, CI e webhooks; testar com **nova chave** pelo canal secreto apropriado; desativar a legacy key e aplicar as instruções oficiais pertinentes para **revogar o JWT secret legado** se a chave exposta ainda puder validar, sem fazer rotação global às cegas. Confirmar desligamento e testes de falha da chave antiga por canal seguro; não compartilhar chaves no chat/GitHub.
2. **0.2 — backup real de PRODUÇÃO:** em **computador Windows confiável**, executar `powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Check` e depois `-Mode Backup`; usar somente host/usuário da produção e senha solicitada localmente em campo oculto. Guardar o arquivo `.dump.gpg` e manifesto em cópia offline privada. Exportar **bytes** dos 9 objetos Storage e demais configurações não cobertas; não declarar cópia completa só por existir dump do banco.
3. **0.2 — restauração isolada:** validar descriptografia, restauração efetiva em **ambiente isolado**, contagens de usuários/leads/atividades, acessos/RLS, funções e arquivos; `pg_restore --list` isoladamente não basta. Não usar produção como destino de teste e não gerar serviços pagos sem orçamento aprovado.
4. **0.3 — reconciliação:** comparar versões remotas 63/57, arquivos locais e baseline histórico, registrar divergências e correções versionadas no GitHub com testes offline; **proibido `db push`, `migration repair`, `db reset` ou cópia direta de tabelas entre projetos** até o inventário estar coerente e o backup validado.
5. **0.4 — isolamento/autorização:** testar duas contas de staging autorizadas sem tocar em usuários reais; verificações negativas de CRUD cruzado e funções `sync-leads`/provider; revisar Auth, RLS e Storage, sempre com política de rollback.
6. **0.5 — finanças:** verificar no painel Usage/Billing dos provedores os limites efetivos, alertas e aprovação de custo zero; os testes sintéticos de `deny by default` não provam a configuração publicada ou as faturas.

**Próximo bloqueio imediato:** evidência da 0.1 (nova credencial operacional + antiga revogada) e 0.2 (backup privado efetivo + teste de restauração). Não mover Overture para produção nem abrir beta até cumprir os portões.


## Complemento 0.1 — bloqueio da credencial legada no Colab V6.3

Em 16/11/2026, mediante solicitação explícita do proprietário para executar o máximo possível da rotação:

- [x] Notebook **`notebooks/Januario_Leads_Fase_9_V6_3_Sessao_Estendida.ipynb`** alterado em `main` para aceitar **somente `sb_secret_`** e rejeitar `eyJ...`/JWT legado **antes de abrir qualquer conexão**; verificação estática local feita na mesma ação. Esta revisão **não** executa o notebook nem cria ou revoga chaves.
- [x] Função implantada de staging `search-places` v31 e `staging-plan-preview` v6 examinadas sem expor valores de segredos: ambas fazem referência à chave moderna e mantêm caminho de compatibilidade legado. **Não remover o fallback ou publicar novas versões antes de confirmar a chave nova ativa em runtime e os testes autenticados.**
- [x] Confirmado que `get_publishable_keys` oferece informações apenas de chaves públicas: a presença de `sb_publishable_` **não é comprovação** de `sb_secret_`.
- [ ] **Sessão Colab antiga desconectada**: não há ferramenta conectada para inspecionar ou desconectar os runtimes pessoais do Google Colab.
- [ ] **Nova chave `sb_secret_` habilitada e consumidores validados**: as ferramentas Supabase conectadas não oferecem criação/revogação/leitura administrativa de chaves secretas. Necessário usar Dashboard; não compartilhar segredo.
- [ ] **JWT legado invalidado e testes negativos**: não realizado, pois a revogação pode afetar sessões/Edge Functions `verify_jwt=true`. Seguir o roteiro oficial de migração do JWT secret, somente após inventariar e validar os consumidores.

**Importante:** isto é uma preparação parcial. A exposição original da `service_role` **continua um bloqueio P0**. Não interpretar o novo guard da Colab como revogação da credencial no projeto.

Docs oficiais: https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys e https://supabase.com/docs/guides/auth/signing-keys


## Continuação 0.1 — 16/11/2026: sessão Colab encerrada e consumidores preparados

**Confirmação do usuário:** a execução do Colab V6.3 foi interrompida e desconectada após aproximadamente o lote 106. A chave moderna `sb_secret_` **já existe** em homologação, segundo o proprietário. **A presença, permissões, runtime e revogação efetiva da chave antiga ainda não foram testados com credencial real.** Não foram compartilhadas chaves nem senhas.

**Checagem read-only do Supabase staging após a desconexão (16/11 às ~08h45 BRT):**
- `public.overture_places`: **338.540 registros**;
- Banco PostgreSQL: **193.246.899 bytes**, aproximadamente **193,25 MB**;
- `overture_phase9_v5_attempts`: **1.654 linhas** de histórico; **0 linhas com `error_code` não nulo nas últimas 24h** segundo filtro por `attempted_at`;
- Checkpoint mais recente: **16/11/2026 às 11:41:35 UTC** (08:41:35 BRT), incluindo `Laranjeiras/SE`. Os checkpoints observados confirmam gravação de progresso, **não validam o número exato de lotes da sessão** nem provam a ausência de alguma gravação ainda em trânsito.

**Preparação de segurança no GitHub:**
- `main`: Colab V6.3 exige `sb_secret_` e rejeita JWT legado antes da conexão.
- [PR #173](https://github.com/wesleyshoto702-hub/januarioleads/pull/173) **draft, não mergeada, não publicada**: `search-places` na URL exata do projeto staging deixa de usar fallback `service_role`; versão atual da `staging-plan-preview` foi recuperada para controle de versão com fallback legado removido. Produção permanece inalterada.
- [CI de segurança da PR](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43860688087) **aprovada**, incluindo testes offline das duas rotas, sem acesso a segredos ou rede Supabase. Validação estática e simulada não prova runtime.

**Portão ainda pendente:** confirmar `SUPABASE_SECRET_KEYS` efetivo com teste autenticado que não recorra ao fallback; fazer rollout reversível das duas funções **somente em staging**, validar resultado com usuário autorizado e custos externos zero, conferir consumidores restantes e então usar o Dashboard para desativar a chave legada e planejar a revogação do JWT signing secret com segurança para funções `verify_jwt=true`. Não iniciar nova Colab até concluir a Fase 0.1.


## Fase 0.1 — rollout das duas funções de homologação em 16/11/2026

**Mudança em staging concluída tecnicamente, validação autenticada pendente.** O usuário confirmou que a última sessão do Colab estava desconectada e que a chave `sb_secret_` já existia. Constatou-se na [documentação do Supabase](https://supabase.com/docs/guides/functions/secrets) que `SUPABASE_SECRET_KEYS` é fornecida por padrão às Edge Functions hospedadas; isso **não comprova** se a chave está ativa no runtime concreto, nem seu uso bem-sucedido.

| Função | Versão anterior | Versão atual | Resultado da verificação |
|---|---:|---:|---|
| `staging-plan-preview` | 6 | **7 ACTIVE** | `SUPABASE_SERVICE_ROLE_KEY` removida do seletor, `SUPABASE_SECRET_KEYS` permanece; `verify_jwt=true` |
| `search-places` | 31 | **32 ACTIVE** | Apenas o bloco de seleção da credencial administrativa alterado: no projeto de staging o fallback JWT é passado como `undefined`; **nove arquivos de dependência idênticos** ao pacote implantado v31, `verify_jwt=true` |

- A implantação foi feita **somente no projeto `prlrxjothrslhswpkoza`**, preservando a fonte anterior via histórico de versões Supabase. Não houve alteração de banco, migrations, produção, quotas nem usuários.
- [PR #173](https://github.com/wesleyshoto702-hub/januarioleads/pull/173) contém a alteração e testes **em draft**. O código da `search-places` implantado foi um **patch mínimo no pacote remoto v31**, e não substituição integral pelo arquivo de GitHub; reconciliar o código-fonte publicado versus PR antes de merge definitivo.
- **Pós-deploy consultado por conector:** v7/v32 ativas, ambas `verify_jwt=true`; staging **338.540 empresas**, **1.654 checkpoints**, **193.246.899 bytes** de PostgreSQL; produção continua com **212 leads e 2 contas Auth**.
- Não foi possível executar requisição HTTP autenticada real no ambiente de execução (nenhum token de usuário deve ser compartilhado ou extraído; acesso direto de rede não disponível). O status ACTIVE e os testes CI **não significam E2E aprovado**, nem provam que a `sb_secret_` autenticou uma requisição privilegiada.
- **Rollback controlado:** para `search-places`, a versão 31 anterior fornece o pacote exato (apenas desfazer o bloco de seleção); para `staging-plan-preview`, a v6 anterior fornece o seletor original. No entanto, **não restaurar o fallback comprometido como solução permanente**; priorizar corrigir acesso à chave moderna, e avaliar o risco de rollback de segurança antes de acioná-lo.

**Próximo portão:** teste autenticado com usuário autorizado em STAGING de `search-places` (somente Overture, provedores externos sem aprovação) e `staging-plan-preview` (operação de simulação intencional e reversível), incluindo um teste negativo de autorização; verificar registros de erro e ausência de gastos. Somente após comprovação da nova credencial e inventário dos consumidores restantes executar a desativação da chave legada e tratar a migração/revogação de JWT signing keys pela documentação oficial. **Fase 0.1 ainda NÃO CONCLUÍDA; imports permanecem suspensos.**


## Teste HTTP real do staging — 16/11/2026 (negativo confirmado, E2E autenticado bloqueado)

**Solicitação do proprietário:** executar o teste autenticado da Fase 0.1. Criado o [script seguro](../scripts/fase0-staging-authenticated-smoke.py) e [workflow GitHub Actions](../.github/workflows/fase0-staging-authenticated-smoke.yml), em `main`, usando `environment: staging`, `timeout-minutes: 5` e somente a URL fixa `https://prlrxjothrslhswpkoza.supabase.co`.

**Resultados reais obtidos:**
- A sintaxe Python e a inicialização do job GitHub Actions passaram após correção de um erro YAML na definição do step.
- A [execução 43864506127](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127) realizou requisições HTTP POST reais com **chave sb_publishable_ pública**, **sem Authorization de usuário**, aos endpoints `search-places` v32 e `staging-plan-preview` v7. Ambos rejeitaram as chamadas com **HTTP 401**, conforme esperado. **Teste negativo de acesso anônimo: APROVADO**.
- Logo após o teste negativo, o job parou no pré-requisito `Staging test account email/password missing from protected secrets`, antes de fazer login. **Teste autenticado e verificação runtime da chave sb_secret_: NÃO EXECUTADOS / NÃO APROVADOS**.
- O teste autenticado planejado solicita `pageToken: "overture:0"`, garantindo caminho de busca Overture que não aciona Geoapify/Google; `staging-plan-preview` recebe um plano inválido, evitando alteração de assinaturas. O teste pode consumir **uma cota interna de busca** ao ser executado com usuário, mas não há faturamento externo autorizado.
- `STAGING_PUBLIC_KEY` no script é **publicável, não secreta**, e foi obtida pela ferramenta Supabase; `service_role`, `sb_secret_` e senhas **não** foram copiados para o repositório ou logs.
- A homologação continha **uma conta Auth e um registro em `private_access`**, mas nenhuma senha de usuário é acessível pelo conector (corretamente). Não criar nem extrair JWT a partir do banco.
  
**Único bloqueio atual para a etapa HTTP autenticada:** configurar no ambiente protegido `staging` do GitHub Actions os dois secrets `JANUARIO_STAGING_A_EMAIL` e `JANUARIO_STAGING_A_PASSWORD` para uma **conta de teste autorizada da HOMOLOGAÇÃO**, sem compartilhar os valores no chat ou no GitHub em texto aberto. Depois rerodar o job; só considerar 0.1 aprovada após retorno `SUCCESS` do smoke autenticado, validação de consumidores, e **desativação + teste negativo** da chave `service_role` legada no Supabase Dashboard.

**Nenhuma autenticação de usuário foi tentada por este último job; nenhuma linha de leads foi alterada. Produção permanece sem alteração.**


## Teste autenticado aprovado — 16/11/2026 (GitHub Actions execução 43864506127)

**Status: teste HTTP autenticado real APROVADO, porém Fase 0.1 ainda aberta até revogação efetiva da credencial legada.** O proprietário adicionou `JANUARIO_STAGING_A_EMAIL` e `JANUARIO_STAGING_A_PASSWORD` ao ambiente protegido `staging` no GitHub Actions, sem compartilhar os valores no chat.

Reexecutada a [execução 43864506127, tentativa 2](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127). Resultado **SUCCESS**, job `authenticated-smoke` concluído com sucesso. Logs confirmam:
- `PASS: unauthorized requests rejected by both functions`: HTTP 401 de `search-places` v32 e `staging-plan-preview` v7 sem sessão.
- `PASS: staging user authenticated (no token printed)`: login da conta de homologação via Auth real.
- `PASS: Overture-only authenticated search; provider=overture; no paid-provider path`: pesquisa real em `search-places`, com `pageToken=overture:0`, retornou HTTP 200, `ok=true` e `provider=overture` usando o caminho privilegiado **sem fallback legado**.
- `PASS: plan-preview authorized entry path, invalid plan rejected without mutation`: chamada autenticada em `staging-plan-preview` v7 retornou `INVALID_PLAN`/HTTP 400 antes da mutação, comprovando guardas do endpoint e a presença de configuração moderna; **não testa uma gravação administrativa da função de planos**.
- Logs do teste não expuseram e-mail, senha, JWT ou chaves secretas; o script utiliza somente chave pública no cliente e segura as credenciais via secrets de ambiente.
- A chamada de busca pode consumir uma quota **interna** de API, sem invocar Geoapify/Google Places. Não houve alterações de assinaturas, nem migração/cópia de dados entre projetos.

**Portões remanescentes da 0.1:** confirmar dependências adicionais (Colab, webhooks, scripts e funções auxiliares), preparar desligamento do JWT legado com verificação das Edge Functions `verify_jwt=true`, desativar a `service_role` legada no dashboard de HOMOLOGAÇÃO e testar seu efetivo bloqueio por canal protegido. **A execução bem-sucedida com a nova credencial não equivale à revogação da antiga**. Nunca enviar segredos para chat ou GitHub.


## Fase 0.1 — auditoria final de consumidores e rollout em 17/11/2026

**Status: preparação técnica e teste autenticado CONCLUÍDOS; revogação da chave legada NÃO EXECUTADA. Não marcar Fase 0.1 como encerrada.** Todas as verificações abaixo foram read-only, exceto commits GitHub de guardas de segurança e deploy exclusivo das Edge Functions de homologação.

### Evidências da auditoria
- **Supabase STAGING somente (`prlrxjothrslhswpkoza`):** 9 Edge Functions ACTIVE, todas com `verify_jwt=true`. Duas funções operacionais relacionadas à busca/planos: `search-places` **v33 ACTIVE**, `staging-plan-preview` **v8 ACTIVE**. As demais 7 funções são endpoints descontinuados de diagnóstico/maps ou verificação que devolvem respostas de recurso desativado, sem procurar chave `SUPABASE_SERVICE_ROLE_KEY`, sem consultas ao banco nem fetch de provedor.
- `search-places` em staging seleciona apenas `SUPABASE_SECRET_KEYS` para operações privilegiadas e somente chaves `SUPABASE_PUBLISHABLE_KEYS` para clientes; fallbacks de `service_role` e `anon` permanecem no mesmo arquivo **somente para produção**, de forma condicional à URL exata. A função já foi testada autenticamente.
- `staging-plan-preview` v8 exige `SUPABASE_SECRET_KEYS` e `SUPABASE_PUBLISHABLE_KEYS` modernos, sem fallback para `SUPABASE_SERVICE_ROLE_KEY` nem `SUPABASE_ANON_KEY`. Versão antiga v7 tinha prioridade indevida de `anon` no fluxo Auth; corrigido antes da revogação.
- Banco STAGING: extensão `pg_cron` = 0, `pg_net` = 0, `vault.secrets` = 0 registros, `public.sync_internal_config` = 0 registros. Auditoria de 27 funções PostgreSQL `public`/privadas não identificou referências textuais à chave legada nem chamadas HTTP de saída nessas funções. Histórico de importação intacto.
- Revisados **39 workflows** GitHub, **20 notebooks** Colab, os três importadores principais e configuração de autenticação do frontend. Workflow legado `import-overture-piloto-staging.yml` é manual, usa credenciais de ambiente `homologacao` e agora está explicitamente **bloqueado por `if: false`** para impedir importações prematuras; a futura credencial esperada foi renomeada para `OVERTURE_STAGING_SECRET_KEY` sem incluir valores. Os três importadores recusam qualquer JWT legado `eyJ...`, exigem `sb_secret_` moderna e restringem o destino ao staging. Para compatibilidade de nomes de variáveis locais antigas, `SUPABASE_SERVICE_ROLE_KEY` é lida **apenas se seu valor for uma `sb_secret_`**, nunca um JWT legado.
- **Colabs antigas:** os notebooks históricos podem continuar contendo caminhos de JWT legado e não devem ser executados. O [README de notebooks](../notebooks/README.md) foi corrigido com aviso e descontinuação explícita. Apenas V6.3 contém bloqueio de JWT legado, porém **todas as importações permanecem pausadas** até liberação.
- Frontend `src/lib/supabase-config.ts`, `src/lib/auth.ts` e BFF usam a variável de chave `VITE_SUPABASE_PUBLISHABLE_KEY`/`BFF_SUPABASE_PUBLISHABLE_KEY` no código. Isso não verifica todas as instalações externas/versões antigas nem segredos mantidos fora do GitHub.
- [PR #173](https://github.com/wesleyshoto702-hub/januarioleads/pull/173) foi **mergeada** na branch principal, eliminando drift de código com fallback legado em staging. O workflow de deploy de produção é por `workflow_dispatch` ou tag `deploy/supabase-*`; os commits de segurança não foram uma solicitação de deploy em produção.
- CI offline de importadores [44111888868](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44111888868) = **SUCCESS**. CI de credenciais de funções [44113375516](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44113375516) = **SUCCESS**.
- Teste HTTP autenticado de staging [43864506127, tentativa **4**](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127) = **SUCCESS** após deploys v33 e v8: ambos recusam chamada sem sessão (401), login de usuário de staging aprovado, `search-places` retorna HTTP 200 via `overture:0` com `provider=overture` sem chamar Geoapify/Google; preview recusa `INVALID_PLAN` autenticado sem mutação de assinatura. O fluxo positivo de alteração de plano **não foi exercitado**. Nenhuma senha/token/chave secreta foi impressa.
- Pós-checagem do banco: **338.540** empresas Overture, **1.654** checkpoints, **193.287.859 bytes** ocupados; produção: **212 leads**, **22.850.707 bytes**. Sem migrações ou operações de dados nessa etapa.
- `get_publishable_keys` mostra chave pública moderna default ativa e **chave `anon` legada ainda ativa (`disabled=false`)**. A ferramenta **não expõe o estado de revogação da `service_role` secreta antiga**. A desativação ainda depende do Dashboard oficial do Supabase.

### Portão manual e limites
1. No projeto **STAGING e somente nele**, [Dashboard → Settings → API Keys](https://supabase.com/dashboard/project/prlrxjothrslhswpkoza/settings/api-keys): usar o controle oficial **Deactivate legacy keys** quando disponível. Este controle desativa o par legado `anon`/`service_role` e pode ser revertido se existir um consumidor esquecido, mas **não constitui sozinho a revogação do antigo JWT signing secret**. **Não executar ainda na produção.**
2. Após a desativação, repetir o smoke `43864506127` e consultar `get_publishable_keys` para confirmar `anon.disabled=true`. Verificar logins, busca, plano inválido e ausência de regressão. Como a ferramenta não consulta secret `service_role`, não alegar revogação efetiva sem evidência adicional do Dashboard/teste de credencial antiga em canal seguro.
3. A chave legada `service_role` é um **JWT assinado pelo segredo legado**. A migração e eventual revogação definitiva do JWT signing secret é etapa independente e exige planejamento: **as 9 Edge Functions estão com `verify_jwt=true`**. A [documentação oficial](https://supabase.com/docs/guides/auth/signing-keys) alerta que a rotação para signing keys modernas pode exigir desligar a verificação legada de gateway **somente após substituir por validação de usuário no código** (`auth.getClaims()` ou equivalente) e validar cada endpoint. **Não girar/revogar signing secret às cegas**, para não interromper Auth.
4. Deixar Google Colab, importadores e workflow legado pausados. Após 0.1, executar 0.2: backup/restauração verdadeira de PRODUÇÃO em ambiente isolado. Não migrar Overture para produção até liberar os portões.

**O conector Supabase não permite administrar API keys, rotacionar signing keys ou operar a sessão Colab do usuário. Essas ações não foram realizadas.**



## 17/11/2026 — desativação das JWT-based API keys confirmada e smoke após o corte

**User action confirmed:** o proprietário utilizou no Dashboard da HOMOLOGAÇÃO a opção **Disable JWT-based API keys**, sem compartilhar chaves ou credenciais. Não houve ação na produção.

**Verificação read-only posterior:** ferramenta `get_publishable_keys` do Supabase staging `prlrxjothrslhswpkoza` reportou `anon` legado `disabled=true` e `default` moderno do tipo `publishable` `disabled=false`. A ferramenta **não expõe o status da antiga `service_role` secreta**, portanto não é correto afirmar que testamos sua recusa por HTTP. A desativação foi feita pelo controle de JWT-based API keys, que visa o par legado.

**Teste real APÓS a desativação:** [GitHub Actions run 43864506127, tentativa 5](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127) = **SUCCESS** (2026-11-17 ~20:44 UTC); logs:
- `PASS: unauthorized requests rejected by both functions` (as duas rotas rejeitam sem sessão, HTTP 401);
- `PASS: staging user authenticated (no token printed)`;
- `PASS: Overture-only authenticated search; provider=overture; no paid-provider path` (HTTP 200, resposta do Overture, nenhum caminho Geoapify/Google);
- `PASS: plan-preview authorized entry path, invalid plan rejected without mutation` (HTTP 400, plano intencionalmente inválido, sem escrita).

**Estado pós-teste:** `search-places` v33 e `staging-plan-preview` v8 ativas em staging, `verify_jwt=true` mantido; `overture_places=338540`, `overture_phase9_v5_attempts=1654`, database bytes `193287859`. Não houve importações, migrações ou alteração da produção.

**Importante:** o botão **Disable JWT-based API keys** não revoga necessariamente o **JWT signing secret legado**: JWTs existentes podem permanecer válidos até que sua chave de assinatura seja efetivamente revogada. A consulta conector não testou o token antigo `service_role`, nem alterou signing keys. Não marcar comprometimento totalmente remediado. Próximo portão: planejar a migração das 9 funções `verify_jwt=true` para autenticação compatível e verificação de JWT no código, antes de rotacionar/revogar o segredo de assinatura legado seguindo [documentação oficial](https://supabase.com/docs/guides/auth/signing-keys). Não pedir nem publicar JWT antigo em arquivos, chat ou logs. Após isso, executar testes de isolamento 0.4 e backup/restauração 0.2; Colab permanece pausada até os portões.


## 17/11/2026 — Preparação JWT ES256 verificada em nove funções

- **Novo documento de procedimento:** [Fase 0.1 — runbook de revogação JWT legado](FASE-0-1-REVOGACAO-JWT-LEGADO-2026-11-17.md).
- `staging-plan-preview` foi corrigida de v8 para **v9 ACTIVE**: antes, `INVALID_PLAN` podia ser devolvido antes de verificar usuário; agora faz Auth e `private_access` antes de analisar o plano. `verify_jwt=true` preservado.
- [CI estática 44173527586](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44173527586): **SUCCESS**. [E2E de homologação 44174568092](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092): **SUCCESS** — bloqueia Bearers inválidos/chave publicável indevida, login do usuário autorizado com JWT **ES256**, sete rotas descontinuadas respondendo 410 com token assimétrico, busca Overture 200 sem provedor externo e preview inválido 400 após autorização sem escrita.
- A documentação oficial atual sobre `verify_jwt` e migração JWT exige cuidado; nossa evidência real mostra que **o gateway atual aceita tokens ES256 com `verify_jwt=true`**. Não desativar globalmente nem rotacionar a chave moderna atual.
- `anon` JWT-based API key legada ainda `disabled=true`, moderna publishable ativa, dados Overture preservados (338.540 empresas, 1.654 checkpoints, 193.287.859 bytes de banco na última consulta).
- **PENDENTE**: inspecionar e revogar o **JWT signing key legado**, se ainda ativo em `Previously used`, pelo Dashboard Supabase de homologação. O conector não expõe esse status; ES256 atual **não garante** que a assinatura legada foi revogada. Só após essa etapa e teste negativo com credencial antiga em canal protegido poderá encerrar 0.1. Não tocar na produção.



## 17/11/2026 — smoke após revogação HS256 informada

Proprietário informou ter confirmado o procedimento da chave `Previous — HS256` no Dashboard de homologação. [Teste HTTP de homologação 44174568092, tentativa 2](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092): **SUCCESS** depois da ação; 401 para chamadas sem login e tokens malformados; login ES256; 7 rotas descontinuadas retornaram HTTP 410; busca somente Overture 200; simulador não alterou planos. Consulta Supabase confirmou `anon.disabled=true`, publishable moderna ativa, 338.540 empresas e 1.654 checkpoints. **Ainda não foi feita checagem criptográfica com a JWT antiga comprometida** e o conector não consulta a seção de signing keys; a revogação foi informada pelo usuário, não independentemente verificada. Ver [roteiro e resultados](FASE-0-1-REVOGACAO-JWT-LEGADO-2026-11-17.md#17112026--revogação-hs256-informada-pelo-proprietário-e-teste-pós-operação).

Próxima fase operacional: **0.2 backup cifrado/restauração real da produção** em ambiente seguro; NÃO confundir testes de autenticação bem-sucedidos com backup pronto. Manter imports do Colab suspensos até aprovação dos portões.
