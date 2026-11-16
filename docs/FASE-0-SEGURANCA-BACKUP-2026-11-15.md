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
