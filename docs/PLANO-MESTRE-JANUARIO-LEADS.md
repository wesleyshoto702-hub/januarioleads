# JANUÁRIO LEADS — PLANO MESTRE E AUDITORIA DE LANÇAMENTO

**Versão:** 1.10 | **Data-base:** 15/11/2026 | **Ambiente auditado:** GitHub `main`, Supabase homologação e produção, projeto Lovable (somente leitura)
**Objetivo único:** entregar um **Buscar Leads + CRM confiáveis** e um beta pequeno, sem custos inesperados e sem perda dos dados existentes. Depois habilitar comercialização.
**Fonte única de prioridades:** este documento. `docs/roadmap-saas-2026-11-06.md` e planos anteriores são históricos, não listas paralelas de trabalho.

> **Regra central: UMA etapa ativa por vez.** Ideias novas entram no backlog. Para mudar a prioridade, registrar motivo, risco e impacto aqui. Não iniciar novas Colabs, enriquecimentos, refatorações estéticas nem pagamentos durante um bloqueio P0/P1 sem explicar a necessidade.

## Exceção controlada — trabalho pelo celular (15/11/2026)

**Decisão do proprietário:** adiar temporariamente a Fase 0 para quando estiver com acesso ao computador. **A Fase 0 não está concluída, continua P0, e o risco da chave `service_role` exposta não foi resolvido.** A recomendação é revogar a credencial comprometida assim que possível. Esta exceção somente altera a ORDEM DAS TAREFAS DE BAIXO RISCO, não os requisitos de lançamento.

**REGISTRO HISTÓRICO DE 15/11: Fase 1 foi autorizada apenas para auditoria somente de leitura no Supabase de HOMOLOGAÇÃO + testes offline sem segredos**; é permitido também preparar código/testes locais do Buscar Leads e UX que não dependam de usuários reais, serviços pagos, segredos ou produção. **Não** iniciar importação Colab com a credencial exposta, não fazer escritas na homologação enquanto a rotação estiver pendente, não mover dados para produção, não alterar Auth/policies/financeiro/cobranças nem abrir beta público. Fases 2–7 podem receber tarefas de preparação offline, mas seus critérios de conclusão continuam bloqueados pelos portões de segurança. O backup da produção continua obrigatório antes de qualquer migração ou mudança de risco.

**Evidência inicial:** [Fase 1 — piloto reproduzível de 18 buscas](FASE-1-PILOTO-OVERTURE-18-BUSCAS-2026-11-15.md) (14 UFs, 0–10 empresas por par consultado, acesso read-only, nenhum provedor externo).


## Atualização do plano em 16/11/2026 — Fase 0 retomada

**FASE ATIVA: Fase 0.** A exceção de 15/11 para trabalhar pelo celular foi encerrada por solicitação do proprietário. A revogação da `service_role` exposta, o backup/restauração da produção e os testes negativos reais continuam pendentes; **nenhum dado real ou migração foi alterado nesta retomada**. Leitura atual: produção **63 migrations remotas, 20/20 tabelas públicas com RLS, 212 leads, 2 usuários Auth, 1 bucket/9 objetos**; homologação **57 migrations remotas, 43/43 tabelas com RLS**. Auditoria e instruções: [registro da Fase 0 atualizado](FASE-0-SEGURANCA-BACKUP-2026-11-15.md#atualização-de-execução--16112026-retomada-solicitada).

A preparação e execução das importações devem ficar **suspensas** até a migração/revogação comprovada da chave comprometida na homologação. Não migrar Overture nem publicar funções ou cobranças na produção antes da Fase 0 ser aprovada. As etapas offline já concluídas permanecem registradas como tal.



## Retomada operacional 16/11 — atualizações da Fase 0.1

- **Colab desligada:** usuário confirmou parada/desconexão; progresso read-only em staging = **338.540 empresas**, 1.654 checkpoints e banco de 193.246.899 bytes; sem confirmação de que o número de lotes da sessão corresponda exatamente ao checkpoint.
- **Chave moderna:** usuário confirmou que já possui `sb_secret_`; ferramenta não permite consultar valor, estado efetivo do segredo ou revogar JWT legada.
- **Duas Edge Functions implantadas EXCLUSIVAMENTE em homologação:** `staging-plan-preview` **v7 ACTIVE** sem fallback `service_role`, `search-places` **v32 ACTIVE** com fallback proibido para a URL exata de staging. `verify_jwt=true` preservado; os nove arquivos auxiliares da busca não foram alterados.
- [PR de testes e preparação #173](https://github.com/wesleyshoto702-hub/januarioleads/pull/173) segue em **draft**; CI offline aprovado. Código de stage atualizado por patch mínimo na versão publicada anterior — reconciliar com o GitHub antes do merge.
- **NÃO CONCLUÍDA:** 0.1 ainda precisa do teste autenticado real com nova credencial, auditoria de consumidores e desativação/verificação negativa da chave antiga. Não confundir implantação com revogação.
- **Próximo passo obrigatório:** smoke test real em HOMOLOGAÇÃO com conta de teste autorizada, sem provedores pagos, e então preparar desativação da JWT legada no Dashboard conforme `verify_jwt=true` das funções. Backup/restauração 0.2 ainda pendentes. [Registro técnico completo](FASE-0-SEGURANCA-BACKUP-2026-11-15.md#fase-01--rollout-das-duas-funções-de-homologação-em-16112026).

### 16/11/2026 — teste HTTP autenticado real de staging aprovado
- [x] Reexecutado [GitHub Actions 43864506127 (tentativa 2)](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127): **SUCCESS**. Conta autorizada autenticou, `search-places` v32 retornou Overture via `overture:0` com HTTP 200 e `provider=overture`, duas funções recusaram acesso não autenticado (401), e `staging-plan-preview` v7 rejeitou plano inválido (400) sem alterar assinatura.
- [ ] **A Fase 0.1 continua PENDENTE:** verificar consumidores adicionais e efetuar/revalidar a revogação de `service_role` legada em HOMOLOGAÇÃO e, se pertinente, migrar o JWT signing secret com cuidado devido a `verify_jwt=true`. O teste do preview não fez gravação administrativa, apenas guardas de autenticação.
- [ ] **A Fase 0.2 continua PENDENTE:** backup real criptografado de produção e restauração em banco isolado.
- Proibida retomada da Colab/importações até fechamento dos bloqueios. [Relatório detalhado](FASE-0-SEGURANCA-BACKUP-2026-11-15.md#teste-autenticado-aprovado--16112026-github-actions-execução-43864506127).

### 17/11/2026 — Fase 0.1: consumidores saneados, revogação ainda pendente
- [x] Revisados **9 Edge Functions, 39 workflows, 20 notebooks** e os scripts de importação relevantes; staging sem `pg_cron`, `pg_net` e segredos no Vault. Notebooks antigos marcados como descontinuados no README.
- [x] **3 importadores Overture** agora recusam `service_role` JWT legada e só aceitam `sb_secret_` no projeto staging; workflow de importação antigo está **bloqueado (`if: false`)**, sem executar downloads.
- [x] PR #173 incorporada à `main`; `search-places` staging v33 e `staging-plan-preview` v8 ativas, sem fallback legado para keys de staging, `verify_jwt=true` preservado. Rotas de produção não foram publicadas.
- [x] CI de scripts [44111888868](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44111888868) e CI de chaves modernas [44113375516](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44113375516) = SUCCESS; HTTP autenticado [43864506127 tentativa 4](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127) = SUCCESS (ambas 401 sem login, busca Overture autenticada HTTP 200, preview rejeita plano inválido sem mutação). Não acionou provedores pagos.
- [ ] **Fase 0.1 NÃO CONCLUÍDA**: no Dashboard Supabase de HOMOLOGAÇÃO, desativar `anon/service_role` legadas, executar smoke após mudança e validar efetiva inutilização. `anon` ainda aparece ativa; o conector não oferece gestão de chaves secretas. Migração/revogação do JWT signing secret deve ser coordenada separadamente; **todas as 9 funções possuem `verify_jwt=true`** e podem quebrar com rotação prematura.
- [ ] **Fase 0.2**: backup e restauração isolada de produção ainda pendentes. Importações Colab/Overture seguem suspensas. [Evidências e checklist](FASE-0-SEGURANCA-BACKUP-2026-11-15.md#fase-01--auditoria-final-de-consumidores-e-rollout-em-17112026).

### 17/11/2026 — JWT-based API keys desativadas; smoke pós-corte aprovado
- [x] No projeto **HOMOLOGAÇÃO**, usuário executou `Disable JWT-based API keys`. Consulta Supabase confirmou `anon` legada com `disabled=true` e `sb_publishable_` moderna ativa.
- [x] [GitHub Actions 43864506127, tentativa 5](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43864506127) **SUCCESS após o desligamento**: chamadas sem login rejeitadas por duas funções; login autorizado; busca Overture-only HTTP 200; preview rejeitou plano inválido sem mutação. Nenhum provedor pago acionado.
- [ ] Ainda **não demonstrado** que a `service_role` antiga foi rejeitada por teste direto (o conector só expõe status da chave `anon` pública). A revogação do `JWT signing secret` legado é separada e **não foi efetuada**; rotacionar sem preparar as nove funções `verify_jwt=true` pode quebrar login/busca. Preparar verificação moderna de usuário no código, migração/rotação controlada e teste negativo apropriado em canal secreto.
- [ ] Fase 0.2: backup/restauração isolada de produção ainda pendentes. Importações continuam pausadas. [Evidências](FASE-0-SEGURANCA-BACKUP-2026-11-15.md#17112026--desativação-das-jwt-based-api-keys-confirmada-e-smoke-após-o-corte).

### 17/11/2026 — JWT ES256 validado em 9 funções; revisão de chave legada no Dashboard
- [x] `staging-plan-preview` v9 corrige ordem de validação: sessão Auth e `private_access` antes do parsing do plano; `search-places` v33 intacta. Nenhuma mudança em produção.
- [x] [CI estático de segurança 44173527586](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44173527586) e [HTTP real pós-deploy 44174568092](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092): SUCCESS. Fake Bearer/chave publicável como Bearer rejeitados (401) pelas 2 funções; login real com JWT **ES256**; 7 endpoints descontinuados devolvem 410 com JWT válido; busca Overture 200 sem provedores pagos; preview de plano inválido 400 sem mutação.
- [x] Nova suíte de CI exige algoritmo JWT assimétrico em homologação, para detectar regressão a HS256.
- [ ] **Único próximo portão manual:** inspecionar estado das chaves em [JWT Signing Keys — HOMOLOGAÇÃO](https://supabase.com/dashboard/project/prlrxjothrslhswpkoza/settings/jwt) e, **se** a chave legada estiver em `Previously used`, planejar revogação da **legada** (não `Current`). O conector não consegue consultar esse estado nem revogar signing keys. A emissão ES256 **não comprova** que o segredo legado esteja revogado.
- [ ] Após revogação segura, repetir smoke e verificar rejeição do JWT comprometido por canal protegido. Fase 0.1 permanece **ABERTA** até confirmação; Fase 0.2 backup/restauração de produção ainda pendente; importações paradas. [Roteiro técnico](FASE-0-1-REVOGACAO-JWT-LEGADO-2026-11-17.md).

### 17/11/2026 — pós-revogação HS256: smoke aprovado; iniciar Fase 0.2

- [x] Proprietário confirmou operação da chave `Previous — HS256` na homologação. **Não temos confirmação independente** da marcação `Revoked` porque o conector não lê signing keys nem acessa a JWT antiga.
- [x] [GitHub Actions 44174568092, tentativa 2](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092) **SUCCESS após a operação**: login ES256, rejeição de Bearer inválido (401), 7 funções descontinuadas com 410, busca Overture 200 sem provedores pagos, preview inválido rejeitado sem escrita. `anon` JWT legada segue desativada; chave `sb_publishable_` ativa.
- [x] Dados de staging preservados: **338.540** empresas, **1.654** checkpoints, **193.287.859 bytes**.
- [ ] Para evidência completa da revogação, observar no painel (sem copiar segredos) a HS256 em `Revoked`; por canal protegido, comprovar que a credencial antiga não é mais aceita se isso for viável, sem expor seu valor.
- [ ] **Fase 0.2 pendente:** executar backup cifrado da produção e restauração isolada, incluindo Storage. Imports e transferências para produção ainda suspensos. [Relatório completo](FASE-0-1-REVOGACAO-JWT-LEGADO-2026-11-17.md).


### 17/11/2026 — Fase 0.2 ativa: inventário e testes offline aprovados

- [x] Supabase de **PRODUÇÃO** consultado somente leitura: **22.850.707 bytes PostgreSQL**, **212 leads**, **259 atividades**, **2 contas Auth**, **3 identidades**, **20 tabelas públicas**, **1 bucket privado** `prompt-visual-references` contendo **9 objetos / 760.690 bytes (metadados)**.
- [x] Reforçado `scripts/fase0-backup-producao.ps1`: só exporta após `-ConfirmoVolumeCriptografado`, restringe host e usuário de PROD, recusa destino dentro do Git, mantém dumps temporários no volume confirmado criptografado, utiliza GPG AES256 e índice `pg_restore`; não grava na produção.
- [x] Novo script `scripts/fase0-backup-storage-producao.py`: cópia read-only dos bytes de objetos privados, por `sb_secret_` de **PROD** somente no computador e campo oculto, com limites, hashes SHA256 e conferência de 9 arquivos / 760.690 bytes. **Ainda não executado no ambiente real**, apenas testes sintéticos.
- [x] [CI 44180260451](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44180260451) **SUCCESS**: 10 testes offline e análise sintática PowerShell, sem segredos, dados ou conexões à produção.
- [ ] **Fase 0.2 NÃO CONCLUÍDA**: falta **backup real local**, cópia de bytes Storage e **restauração efetiva em banco/stack Supabase isolada**, inclusive RLS/Auth/arquivos. O Supabase CLI `db dump` padrão exclui schemas gerenciados `auth/storage`; `pg_restore --list` **não comprova** restauração. Referência oficial em [runbook Fase 0.2](FASE-0-2-BACKUP-RESTAURACAO-PRODUCAO-2026-11-17.md).
- **Próxima ação operacional no Windows do proprietário:** `powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Check` na raiz do repositório; depois usar `-Mode Backup -OutputDirectory <volume-cifrado> -ConfirmoVolumeCriptografado` com prompts ocultos e sem enviar senhas. Importações seguem pausadas.

### 17/11/2026 — PostgreSQL de PRODUÇÃO: backup local criptografado executado

- [x] Proprietário forneceu log do comando local `fase0-backup-producao.ps1 -Mode Backup -ConfirmoVolumeCriptografado`, com `pg_dump` de `public/auth/storage`, criptografia simétrica AES256 com GnuPG e conferência `pg_restore --list` concluídas sem erro.
- [x] Nome do arquivo local gerado: `januario-prod-20261117T225954Z.dump.gpg` e manifesto `januario-prod-20261117T225954Z-manifest.json` na pasta privada `$HOME\JanuarioLeads-Backups`. **Os arquivos não foram transferidos ao repositório.**
- [ ] **Ainda NÃO foi feita restauração real** (nem validação independente dos bytes na ferramenta); `pg_restore --list` sozinho não comprova recuperabilidade.
- [x] **18/11/2026: cópia local manual do Storage** (`prompt-visual-references`) reportada pelo proprietário: **9 arquivos, 760.690 bytes**, em `$HOME\JanuarioLeads-Backups\Storage-Privado`. Correspondência de contagem e soma de metadados, **sem verificação dos hashes individuais ou dos caminhos**, portanto não afirmar equivalência byte a byte.
- [ ] **Restauração real isolada continua pendente.** Verificar disponibilidade de Docker Desktop/Supabase CLI no computador antes de qualquer restore; manter produção intocada. **0.2 segue EM EXECUÇÃO**, importações pausadas. Detalhes: [runbook 0.2](FASE-0-2-BACKUP-RESTAURACAO-PRODUCAO-2026-11-17.md).

## 0. Diagnóstico confirmado em 15/11/2026

### Dados e ambientes
- Homologação: `prlrxjothrslhswpkoza`. `overture_phase9_v5_status`: **321.179 registros**, **264.030 preliminarmente úteis**, em **5.572 municípios / 27 UFs**. Os registros **não são 264 mil empresas verificadas**, nem significam cobertura plena de todos os nichos.
- Campos preenchidos na tabela inteira (não verificados externamente): telefone **296.652**, e-mail **228.277**, website **128.850**, Instagram **42.742**. Não confundir preenchimento com número válido, pertencimento correto ou site inexistente.
- Banco homologação: **aproximadamente 177 MB** em PostgreSQL conforme `pg_database_size`; tamanho total da tabela Overture aproximadamente **163 MB**. O guardião local da Colab usa 340 MiB para Overture / 440 MiB para banco, **não** uma quota comercial garantida do Supabase.
- Produção: `czkazbianiflhldenhcj`. **A tabela Overture não existe na produção.** Existem **212 leads no CRM e 2 contas Auth**: qualquer migração destrutiva pode prejudicar usuários.
- Todas as tabelas observadas em `public` nos dois projetos têm **RLS habilitado**; a tabela `overture_places` na homologação **não permite SELECT direto a `anon` / `authenticated`**. Isso é positivo, **não substitui** auditoria de policies, funções `SECURITY DEFINER`, outros endpoints e isolamento entre contas.
- Importador V6.1 terminou após **HTTP 429 / `fonte_taxa`**: último checkpoint em **15/11 às 16:49 BRT**. A própria Colab exige **8h de cooldown**. Não contornar o bloqueio. Meta 600k é **aspiração, não pré-requisito** de beta.
- Projeto Lovable publicado; última revisão registrada `961b8a595ee047f6045837774746b5bef88a0457`. Isso **não prova** que todos os fluxos da publicação foram testados.

### Buscar Leads e modelo de negócios
- Frontend `SearchLeadsView.tsx` já tem pesquisa por cidade/UF/nicho, paginação, filtros de telefone/e-mail/WhatsApp/site/Instagram, filtros rápidos, favoritos e transição ao CRM. Há persistência de resultados permitidos e ligação ao `search-places` autenticado.
- A Edge Function **já prioriza Overture**, e só tenta Geoapify/Google conforme suficiência, aprovação e quotas configuradas. A função em homologação foi atualizada para **versão 30** com deduplicação geográfica, mas ainda **não** foi validada ponta a ponta com conta de usuário.
- Catálogo em código: **216 nichos** (16 grupos), **125 com mapeamento exato** Overture; **91 sem correspondência exata**. NICHOS ≠ empresas; nunca usar categoria genérica de um grupo inteiro para "preencher" resultados.
- Piloto SQL de 12 pares nicho/cidade encontrou de **0 a 10** registros: por exemplo **Lavras/MG + Barbearia = 0**, **Campinas/SP + Barbearia = 3**, **RJ/Rio de Janeiro + Restaurante = 10**, **DF/Brasília + Clínica Odontológica = 8**. Essa amostra ainda é insuficiente para promessa de pesquisa nacional rica em qualquer nicho.
- Planos apenas preparados na homologação: `free` **5/dia, R$0**, `pro` **25/dia, R$19,90**, `advanced` **70/dia, R$29,90**. **DIVERGÊNCIA:** decisão comercial anterior para Pro foi **R$14,90**, não R$19,90. Produção não tem as tabelas SaaS correspondentes; existem **0 eventos de faturamento** na homologação. **Não afirmar que cobranças estão operacionais.**
- Homologação tem um registro de assinatura `pro/active` para teste, mas isso **não demonstra pagamento**.
- README e roadmap antigos descrevem Google Places como fonte principal e alguns fluxos comerciais já ultrapassados: **documentação desatualizada**.

### Segurança, terceiros e operação
- Houve exposição anterior de uma chave **service_role** de homologação em conversa/código. **Não há comprovação de rotação ou revogação. P0 obrigatório antes de ampliar acesso**; não guardar, repetir ou testar o segredo comprometido.
- Linter Supabase: ambos os projetos alertam **Leaked Password Protection Disabled**; produção aponta `extension_in_public` (WARN). Outras observações sobre **RLS sem policy** em tabelas administrativas de homologação são informativas, não prova de exposição (avaliar privilégio efetivo antes de mexer). Produção registra algumas FKs sem índice (INFO).
- `sync-leads` em produção declara `verify_jwt=false`, mas o código implementa autorização própria `x-sync-secret` por hash, chave privada e condições de gasto; **auditar a rotina com teste negativo** em vez de assumir insegurança ou liberá-la por conta da flag.
- Google Places: armazenamento, redistribuição, caching e atribuições são restritos. **Não misturar campos Google com base própria exportável** e revisar leads já salvos, detalhamento e cache por proveniência.
- Overture Places tem licenças CDLA Permissive 2.0 / Apache 2.0, com obrigações por fonte e avisos. Revisar atribuição/NOTICE; a base contém pontos não comerciais e duplicações segundo a própria documentação.
- Dados de contatos de **pessoas físicas identificáveis**, mesmo em contexto profissional, podem requerer análise LGPD. Definir finalidade, minimização, direitos do titular e mecanismo de oposição antes de vender prospecção em escala.
- Supabase Free anuncia **500 MB de banco por projeto**, recursos/limites de egress e **sem backups automáticos**. Plano efetivo e saldo de cada projeto devem ser conferidos no painel; não presumir custo 0 só porque a ferramenta usa a base Overture.

**Documentação externa verificada:**
- [Overture Places / qualidade](https://docs.overturemaps.org/guides/places/)
- [Overture Attribution & Licensing](https://docs.overturemaps.org/attribution/)
- [Google Places / regras de armazenamento e atribuição](https://developers.google.com/maps/documentation/places/web-service/policies)
- [ANPD / guia de legítimo interesse](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse)
- [Supabase / preços e limites](https://supabase.com/pricing)

## Registro de execução da Fase 0 — 15/11/2026

**Fase 0 INICIADA, NÃO CONCLUÍDA.** Auditoria apenas de leitura confirmou conta Supabase **Free** sem backups automáticos diários, baseline de **212 leads/2 contas**, checagens de integridade e RLS; ainda é necessário **revogar credencial antiga** e **gerar/testar backup recuperável**. Foi preparado o script local criptografado, sem acesso a dados ou senhas no CI.

**Registro técnico detalhado e checklist:** [Fase 0 — segurança, baseline e backup](FASE-0-SEGURANCA-BACKUP-2026-11-15.md).

## 1. Visão de entrega — não confundir etapas

**Produto mínimo do beta:** pesquisa real por UF/cidade/nicho → resultados úteis e identificados por origem → filtros verdadeiros → salvar no CRM → favoritar → enviar mensagem manualmente → registrar histórico e próximo acompanhamento. Sem envio automático em massa, sem prometer Instagram confirmado, sem "sem site" como prova, sem consultas pagas.

**Beta limitado** e **lançamento pago** são metas diferentes. Não exigir 600 mil úteis, todos os 216 nichos cheios, automações avançadas, mapas, pagamento ou redesign para o primeiro beta. No lançamento pago, exigir cobrança, direitos de acesso e suporte funcionais.

## 2. Etapas ordenadas e portões objetivos

### FASE 0 — CONTENÇÃO, BASELINE E BACKUP | **RETOMADA EM 16/11/2026 — AINDA NÃO CONCLUÍDA / BLOQUEIO DE PRODUÇÃO** | P0
- [ ] **0.1** Confirmar revogação/rotação da antiga `service_role` comprometida, atualizar todos os usos no Colab/ambientes e verificar que a chave antiga perdeu o acesso. **Nunca enviar credenciais ao ChatGPT ou GitHub.**
- [ ] **0.2** Criar backup recuperável da **produção**, protegendo os **212 leads** e dados associados; testar restauração em ambiente isolado. Verificar o recurso disponível no plano Supabase.
- [ ] **0.3** Registrar versões/commit do frontend, Edge Functions e migrações de cada ambiente, tabela/policies, usuários e volumes, para rollback. **Pendência real encontrada no CI:** o auditor `scripts/audit_migration_reconciliation.py` espera 24 migrations locais, mas encontra 42. Essa falha já ocorria no workflow `Validar catálogo de nichos` da PR #162, anterior à etapa 1.3; identificar versões/aplicação efetivas e corrigir o mecanismo de reconciliação, **sem excluir migrations nem aplicar SQL**. A PR #162 também apresentou falha no teste de navegador com backend simulado; revisar regressão do frontend antes de liberar beta.
- [ ] **0.4** Revisar RLS para duas contas, chamadas privilegiadas, proteção Auth (senhas vazadas), `sync-leads` e exposição dos endpoints com testes negativos. Não alterar Auth em produção sem plano de reversão.
- [ ] **0.5** Verificar se todo serviço externo faz *deny by default*: nenhuma chamada Google ou Geoapify paga sem aprovação explícita, limite por SKU, usuário e projeto; conferência das faturas reais.
**Sair da fase quando:** chave revogada confirmada, backup restaurável, inventário de deploy e testes de isolamento/autorização aprovados, risco financeiro limitado. **Não dispensar esta fase para produção, beta público ou cobrança; apenas antecipar tarefas seguras de leitura e desenvolvimento offline.**

### FASE 1 — QUALIDADE DO CATÁLOGO OVERTURE | P1
- [x] **1.1** Fixar conjunto reproduzível de testes por **18 pares** de nicho/cidade em 14 UFs, com SQL somente leitura e relatório agregado. [Relatório](FASE-1-PILOTO-OVERTURE-18-BUSCAS-2026-11-15.md) e [SQL](../scripts/fase1-overture-amostra-18-readonly.sql). *Este aceite valida a amostra, não toda a qualidade da base.*
- [x] **1.2a — Auditoria quantitativa interna:** 321.179 registros auditados via consultas `SELECT` agregadas; telefone/e-mail/website/Instagram plausíveis por sintaxe, grupos com nome/contato repetidos, ausência de endereço, confiança, mapeamento original de 187 categorias (corrigido na Fase 1.3) e distribuição entre municípios. [Relatório Fase 1.2](FASE-1-2-AUDITORIA-QUALIDADE-OVERTURE-2026-11-15.md) e [SQL reproduzível](../scripts/fase1-2-auditoria-overture-somente-leitura.sql). **Não equivale a verificar empresas ou contatos no mundo real.**
- [ ] **1.2b — Validação qualitativa / real:** medir taxa de empresas efetivamente existentes, titularidade dos contatos, precisão da associação ao nicho e filiais legítimas por amostras externas legalmente autorizadas, quando a Fase 0 estiver resolvida. A coluna `data_release` contém apenas `latest`; snapshot real deve ser registrado na próxima carga. **Não marcar esta parte como concluída agora.**
- [x] **1.3a — Auditoria dos 216 nichos e preparação offline de mapeamentos:** 125 anteriormente mapeados → **164 com correspondência preparada no GitHub**, **52 ainda sem correspondência**; 59 códigos específicos novos, permitindo potencialmente encontrar **4.291 registros existentes** a mais (194.629 → 198.920 em categorias únicas no banco). Sem publicar Supabase. [Relatório completo](FASE-1-3-AUDITORIA-NICHOS-2026-11-15.md) e [Matriz CSV dos 216 nichos](FASE-1-3-MATRIZ-COMPLETA-216-NICHOS.csv).
- [ ] **1.3b — Validação antes da publicação:** testar nichos novos na busca autenticada no staging somente após corrigir a Fase 0, medir falsos positivos e revisar os 52 nichos sem correspondência. Não inferir cobertura uniforme nem mapear categorias amplas como `school`, `professional_service`, `shopping`, `party_and_event_planning` apenas para trazer resultados.
- [x] **1.4a — Cobertura nacional quantitativa e reproduzível:** 216 nichos × 5.572 municípios, **1.203.552 pares** analisados. Mapeamento preparado: **1.079.030 pares sem candidatos, 123.926 limitados, somente 596 pares com ≥8 candidatos e ≥5 telefones de formato plausível**; **469 municípios** e **23 nichos** atingem ao menos uma dessas combinações. [Relatório 1.4](FASE-1-4-AUDITORIA-COBERTURA-2026-11-15.md), [CSV 216 nichos](FASE-1-4-MATRIZ-COBERTURA-216-NICHOS.csv), [CSV 27 UFs](FASE-1-4-COBERTURA-27-UFS.csv), [18 casos](FASE-1-4-COBERTURA-18-CENARIOS.csv), SQL read-only e CI. **Não equivale a cobertura comercial validada.**
- [ ] **1.4b — Classificação real na interface:** apresentar quantidades e estados honestos a partir do resultado efetivamente carregado da busca (após deduplicação, filtros e limitações), **não usar CSV de snapshot para rótulos de cobertura em produção**, verificar UX autenticada após resolver Fase 0. Não ativar fontes pagas para camuflar lacunas.
- [x] **1.5a — Auditoria quantitativa + correção conservadora preparada:** 321.179 IDs distintos, **6.864 grupos** com nome/cidade repetidos, **276 pares a até 15 metros**, dos quais **209 com conflito estrutural** (endereço/categoria/telefone) e **67 sem conflito observado** (não confirmados como duplicatas). **22.034 registros com telefone compartilhado, 15.299 com e-mail compartilhado**; formatos de telefone, website e Instagram auditados. Código de deduplicação conservadora **preparado no GitHub, sem deploy**; testes offline fictícios. [Relatório e ressalvas](FASE-1-5-AUDITORIA-DUPLICACOES-CONTATOS-2026-11-15.md) e [SQL readonly](../scripts/fase1-5-auditoria-duplicacoes-contatos-readonly.sql).
- [ ] **1.5b — Validação real pendente:** verificar amostra de empresas, filiais, contatos, site ativo e propriedade do perfil Instagram, além do comportamento do deduplicador na busca autenticada/CRM, **somente após resolver a Fase 0**. Sintaxe não prova contato válido nem WhatsApp ativo. Não apagar/fundir registros automaticamente.
**Sair da fase quando:** relatório claro de cobertura e qualidade, 0 misturas flagrantes de nichos e 0 duplicações óbvias nos cenários de regressão. Se a amostra tiver pouca cobertura, **reduzir o escopo inicial anunciado**, não ficar importando indefinidamente.

### FASE 2 — BUSCAR LEADS DE PONTA A PONTA NO STAGING | P1
- [x] **2.1a — Fluxo de pesquisa simulado e testado:** funções REAIS conectadas à UI extraídas para helpers puros, transporte HTTP com fetch falso, 43 empresas fictícias em **3 páginas (20+20+3)**, UF/cidade/nicho, erros 401/403/429/503, filtros de contatos/site/Instagram/status/chance, CRM e preservação de Instagram confirmado. Falsas duplicações por telefone compartilhado corrigidas e endereços normalizados. [Relatório e CI da Fase 2.1a](FASE-2-1A-BUSCAR-LEADS-TESTES-OFFLINE-2026-11-15.md). **Sem rede, segredos, usuários reais ou deploy.**
- [ ] **2.1b — E2E autenticado real:** validar UX desktop/mobile, login/JWT/RLS, 18 pesquisas, estado do CRM e chamadas externas efetivamente bloqueadas após resolver a Fase 0. Testes de navegador com API simulada ainda têm falhas por investigar.
- [x] **2.2a — Paginação, estados e cache offline com funções reais:** **10 cenários** de tokens de continuação, HTTP inválido bloqueado antes de qualquer provedor, 125 empresas fictícias e **5 páginas de até 20** (máximo 100), respostas fora de ordem, cliques duplicados, falhas/cota, cache restrito a **fontes Overture/Geoapify**, sem tokens Google, até **60 registros** e mensagem específica para estado vazio. Corrigido risco de token desconhecido entrar no caminho Google pagável e de cache truncado pular páginas. [Relatório Fase 2.2a](FASE-2-2A-BUSCAR-LEADS-RESILIENCIA-OFFLINE-2026-11-15.md). **Somente GitHub, sem deploy nem custos externos.**
- [ ] **2.2b — Testes de navegador autenticado, cache e sessão reais:** verificar RLS, trocas de conta, paginação de todos os provedores, erros ao vivo e UI responsiva. **Pendente e bloqueado pela Fase 0**.
- [x] **2.3a — Clareza de filtros e contadores offline:** oito filtros e seis atalhos com textos/explicações ligados às funções realmente usadas; `Telefone informado` (campo preenchido) separado de `Número compatível com WhatsApp` (somente formato), `Site não identificado` e `Instagram não confirmado` não afirmam inexistência; perfil marcado com alta confiança sem revisão pendente não é comprovação oficial. **X carregados e Y exibidos** explicitamente limitados aos resultados da pesquisa, inclusive antes de carregar as próximas páginas. Corrigido score heurístico que contava Instagram com confiança ausente. [Relatório 2.3a](FASE-2-3A-FILTROS-CONTADORES-HONESTOS-2026-11-15.md) e CI Deno/Python offline, sem deploy.
- [ ] **2.3b — Validação real/UX mobile:** testar textos e contadores em navegador autenticado, RLS, diferentes municípios e páginas, confirmação de perfil e CRM. **Bloqueado pela Fase 0.**
- [x] **2.4a — Observabilidade e baseline SINTÉTICO offline:** instrumentação do HTTP real de `Buscar Leads` com coletor **local limitado a 256 observações** (máximo 1000), sem registrar conteúdo de buscas, tokens, telefones ou nomes; p50/p95 nearest-rank, contagem de erros/sucessos, respostas 2xx/4xx/5xx, tentativas de rede e resultados. Relógio simulado com 10 requisições, **p50 = 50 ms e p95 = 100 ms artificiais, 20% falhas fictícias**; 5 páginas Overture fictícias = 5 leituras de até 250 candidatos, até 100 resultados e **0 chamadas pagas apenas no teste**. Os percentis **NÃO representam desempenho real do SaaS**. [Relatório 2.4a](FASE-2-4A-OBSERVABILIDADE-LATENCIA-MOCK-2026-11-15.md), testes offline e CI. Nenhum deploy.
- [ ] **2.4b — Medição e tuning reais:** p50/p95 em busca autenticada com fonte Overture e relógio monotônico, contagem **no servidor** por provedor (incluindo fontes pagas), investigação de planos de consulta/índices/paginação, ensaios controlados sem custo, rollback e validação responsiva. **Bloqueado pela Fase 0.**
- [x] **2.5a — Jornada CRM em testes sintéticos:** `Buscar → Salvar → Favoritar/desfavoritar → Status → Próxima ação → Contato confirmado/follow-up` com empresas fictícias. Extraídos e conectados à UI helpers puros para conversão de empresa, favorito, status e agendamento. Proteção por sessão contra múltiplos saves concorrentes de mesma origem/empresa conhecida, sem confundir filiais com telefone compartilhado; falha permite retry e exclusão limpa a proteção. Corrigido histórico que classificava Overture como Google e Instagram sem confiança promovido a `high`. Fila de mutações testada com revisão concorrente e conta fictícia alterada. [Relatório da 2.5a](FASE-2-5A-CRM-JORNADA-SINTETICA-2026-11-15.md). **Sem banco ou usuário real.**
- [ ] **2.5b — Validação real/isolamento:** editar e salvar após login, dois usuários reais, múltiplas abas/dispositivos, favoritos, fila, histórico, confirmação manual WhatsApp e agendamento, RLS/uniqueness e rollback após Fase 0. Nunca considerar a trava do frontend uma garantia de unicidade no banco.
- [x] **2.6a — Guardas de custo OFFLINE:** rotas reais da Edge Function Google Text Search, Place Details, Geoapify geocode/Places agora usam reserva atômica antes do `fetch`, com **negação por padrão**. Cap ausente, zero, inválido ou chave ausente não permitem fallback pago; Google exige `GOOGLE_PLACES_SPEND_APPROVED="true"`. Descoberta paga de Instagram por OpenAI ganhou opt-in financeiro e RPC de orçamento própria, **ainda não criada**; portanto segue desabilitada mesmo com chave. Corrigido Instagram de fonte desconhecida promovido a `high`/Google no backend. Testes com chaves fictícias e `fetch` interceptado demonstram **zero chamadas EXTERNAS mockadas** com orçamento zero, preservando a busca interna Overture; **não comprovam zero cobrança real**. Typecheck da Edge Function e regressões 2.2a/2.4a/2.5a no CI. [Relatório 2.6a](FASE-2-6A-ORCAMENTO-ZERO-PROVEDORES-OFFLINE-2026-11-15.md). Nenhum deploy.
- [ ] **2.6b — Auditoria viva de zero custo:** após Fase 0, conferir segredos e habilitações por ambiente, quotas SQL atômicas por projeto/SKU, outros consumidores em jobs/Edge/scripts, logs/medição controlada com conta autenticada, faturas e alertas nos consoles de provedores. **Bloqueada pela Fase 0.** Não confundir bloqueio no código com garantia de fatura R$0.
**Sair da fase quando:** cenário completo Buscar → Salvar → Favoritar → Próximo contato funciona em desktop/mobile; filtros e erros honestos; **zero gasto não autorizado**; CI + teste real autenticado aprovados.

### FASE 3 — CONFORMIDADE, CUSTOS E PUBLICAÇÃO CONTROLADA | P1
- [ ] **3.1** Revisar contratos Google/Geoapify, atribuições Overture por fonte, separação da proveniência, armazenamento/remoção de dados Google, licenças e NOTICE em interface.
- [ ] **3.2** Preparar termos, política de privacidade, aviso de dados empresariais, processo de contestação/correção/remoção e avaliação LGPD para dados pessoais de contato e histórico de abordagem.
- [ ] **3.3** Definir orçamento mensal máximo para infra, egress, Edge Functions, Google, Geoapify, Colab; configurar alertas/safety caps e acompanhar consumos reais. R$0 para fontes pagas sem aprovação.
- [ ] **3.4** Escolher procedimento de transferência **incremental e versionada** de dados Overture aprovados para produção; nunca restaurar dump inteiro de staging sobre produção. Iniciar com lote pequeno e reconciliar contagens/IDs.
- [ ] **3.5** Conferir backup + rollback + execução canário; garantir que **212 leads de produção** e permissões não mudem. Disponibilizar apenas segmentos/cidades que realmente tenham qualidade suficiente.
- [ ] **3.6** Testar rollback do endpoint/tabela de origem sem perder leads do CRM.
**Sair da fase quando:** documentação legal e técnica revisada, atribuições corretas, limite de gastos definido, migração canário aprovada e produção preservada.

### FASE 4 — CRM E EXPERIENCE PRONTOS PARA O BETA | P1
- [ ] **4.1** Testar login, encerramento de sessão, recuperação, cadastro beta, conta autorizada vs não autorizada e isolamento entre dois usuários (web + mobile).
- [ ] **4.2** Revisar jornada completa: Pesquisar → filtrar → analisar detalhes → salvar → favorito → mensagem **manual** no WhatsApp → acompanhamento → financeiro **do lead/CRM** → saída.
- [ ] **4.3** Consertar erros críticos, limites do modal, responsividade, acessibilidade, estados vazios, timeout, carregamento e gravações idempotentes. Preservar preferências existentes.
- [ ] **4.4** Remover/promover promessas falsas da landing e do app; não divulgar "todas as empresas do Brasil", "Instagram confirmado", "envio automático" nem planos pagáveis antes de estarem prontos.
- [ ] **4.5** Testar atualização/deploy pela rota escolhida sem depender da Vercel, incluindo ambiente isolado, rollback e publicação Lovable.
**Sair da fase quando:** usuário beta completa a jornada sem assistência e 0 falhas bloqueadoras abertas.

### FASE 5 — BETA CONTROLADO E DECISÃO DE VALOR | P1
- [ ] **5.1** Convidar **3–5 usuários de teste** de perfis diferentes (e/ou operadores de nichos diferentes). Convites manuais, sem autoassinatura.
- [ ] **5.2** Medir: primeira busca bem-sucedida, leads salvos, leads utilizáveis, erro por pesquisa, contatos/seguimentos registrados, retorno em 7 dias e feedback de qualidade.
- [ ] **5.3** Registrar os **3 maiores problemas reais**, corrigir somente eles e revalidar, sem adicionar features por preferência isolada.
- [ ] **5.4** Definir quais nichos/cidades podem ser comercialmente prometidos e o posicionamento: **prospecção assistida**, não banco nacional perfeito.
**Sair da fase quando:** todos os participantes podem buscar e salvar leads de forma confiável, há evidência de utilidade e custo mensurável, suporte e cancelamento/remoção de dados definidos.

### FASE 6 — PLANOS, CADASTRO E PAGAMENTOS | P2 / OBRIGATÓRIA ANTES DE VENDER ASSINATURAS
- [ ] **6.1** Decidir e registrar preços sem inconsistência: Free **5 leads/dia R$0**, Pro **25/dia R$14,90 planejados**, Advanced **70/dia R$29,90 planejados**. Corrigir preço Pro do staging (**hoje R$19,90**), quando aprovado como regra final; conferir copy/landing.
- [ ] **6.2** Especificar exatamente a ação que consome 1 crédito (desbloquear/salvar/consulta), período do dia, repetições, falhas, retries, limites e exclusões. Quotas **enforced no servidor** com testes de concorrência e bypass.
- [ ] **6.3** Escolher gateway compatível com Brasil e testar assinatura, webhook assinado, idempotência, renovações, cancelamento, inadimplência, reembolso e mudança de plano. Nenhuma assinatura ativa com base apenas em flag cliente.
- [ ] **6.4** Resolver requisito de login Google-only vs cadastro por e-mail/senha e acesso por convite; documentar o fluxo escolhido e testar Google OAuth/recuperação/compartilhamento de contas.
- [ ] **6.5** Rever custo e margem por usuário e pressão Free/Pro/Advanced nas APIs, banco e suporte; definir plano sem margem negativa.
**Sair da fase quando:** pagamento de teste cria direitos de acesso corretos, testes de cobrança e cancelamento passam, limites não são burláveis, telas mostram preço consistente.

### FASE 7 — LANÇAMENTO COMERCIAL GRADUAL | P2
- [ ] **7.1** Abrir em ondas pequenas; monitorar custos e limites por conta e resposta das buscas.
- [ ] **7.2** Implantar rotina de backups, restauração, monitoramento de erros e alertas, relatórios de qualidade semanal e suporte.
- [ ] **7.3** Mensurar conversão cadastro → primeira busca → primeiro lead salvo → ativação → pagamento → retenção.
- [ ] **7.4** Revisar a cada ciclo se receita cobre infra, APIs, gateway e suporte; só ampliar se qualidade e margem permanecerem aceitáveis.
**Sair da fase quando:** usuários pagantes conseguem usar todos os recursos anunciados e manter a assinatura sem ações manuais não declaradas.

### FASE 8 — EXPANSÃO (PÓS-LANÇAMENTO) | P3
- [ ] Retomar Colab com ritmo adaptativo e cooldown do Overture, checkpoints, nenhuma sessão duplicada e proteção de armazenamento; buscar 600 mil úteis **somente se a demanda e o orçamento justificarem**.
- [ ] Ampliar e validar nichos sem mapeamento; atualizar Overture por release e fazer upserts incrementais seguros.
- [ ] Geoapify Free ou Google Places como suplemento **somente com autorização e orçamento**, nunca como enriquecimento em massa ou banco secundário baseado em cache proibido.
- [ ] Novas automações, pontuação avançada, campanhas e integrações após evidência de uso; **não restaurar Buscar via Maps** sem um motivo fundamentado.

## 3. Testes de aceitação mínimos, sempre reproduzíveis
1. **Isolamento**: duas contas não conseguem ler ou editar leads da outra, nem aumentar limites pelo cliente.
2. **Sem custo inesperado**: chamadas opcionais negadas por padrão; testes com quotas saturadas/zero; gastos reais conferidos.
3. **Sem perda de dados**: contagens/IDs de produção antes e depois de mudanças batem; recuperação testada.
4. **Relevância**: cidade, UF e nicho corretos, com fonte e confiança claras, sem resultados inventados para esconder lacunas.
5. **CRM**: adicionar, favoritar, contatar manualmente e acompanhar sem duplicar ou perder notas.
6. **Comercial**: preço, promessa, cobrança, limites e cancelamento compatíveis com o que foi realmente implementado.

## 4. Quadro de execução e política contra o ciclo infinito

| Ordem | Fase | Estado em 15/11 | Dependência |
|---|---|---|---|
| 0 | Segredos, backup e segurança | **ADIADA a pedido — continua bloqueio P0** | antes de qualquer ação de risco / lançamento |
| 1 | Qualidade Overture | **Auditorias 1.1, 1.2a, 1.3a, 1.4a e 1.5a concluídas; validações E2E/reais bloqueadas pela Fase 0** | somente leitura/offline; sem deploy/produção |
| 2 | Buscar Leads E2E staging | **2.1a–2.6a no GitHub com testes offline; etapas b de validação real pendentes; próxima segura 3.1a** | Fase 0 obrigatória antes de testes reais/deploy |
| 3 | Compliance/custos/migração canário | documentação/compliance permitidos; migração bloqueada | 0–2 |
| 4 | CRM e UX beta | testes offline/visuais permitidos; aceite real pendente | 0 + 2–3 |
| 5 | Beta fechado | não iniciado | 4 |
| 6 | Planos/pagamentos | estrutura staging parcial, cobrança não pronta | 5 |
| 7 | Lançamento pago | não iniciado | 6 |
| 8 | Expansão e 600k | **ADIADA** | demonstração de demanda |

**Ritual ao concluir cada tarefa:**
- Escrever **O que foi feito | Evidência (PR/CI/consulta) | O que permanece pendente | Próxima ação única**.
- Só marcar `[x]` quando houver evidência. Não confundir PR criada, CI verde, deploy ativo e teste de usuário: cada coisa é distinta.
- Se surgir nova ideia: registrar em **Backlog congelado** e voltar à fase atual.
- Em falha: corrigir o problema mais prioritário da fase; se custo/risco impedir, reduzir escopo do beta com transparência. **Não estabelecer "600 mil" como barreira para o beta.**
- Manter uma fase ativa e no máximo um conjunto de alterações em execução por vez; revisar este documento após entregas concluídas, não em cada nova recomendação.

## 5. Backlog congelado — não perder, mas não executar ainda
- [ ] Enriquecimento automático em massa com Geoapify/Google.
- [ ] Importar acima de 600 mil / atualizar release Overture automaticamente.
- [ ] Melhorias estéticas cosméticas, animações adicionais, novas cores e reestruturação de telas já usáveis.
- [ ] Expandir funcionalidades comerciais de propostas/campanhas/IA antes de validar o fluxo principal.
- [ ] Análise preditiva complexa e automações de WhatsApp sem opt-in e sem validação legal.
- [ ] Reintrodução de Mapas/Buscar via Maps (fora do escopo por decisão anterior).
- [ ] Integração automática de pagamentos antes do beta estabilizado.

## Colab preparada em paralelo (não altera fase ativa)
- [x] **Próxima Colab V1 de triagem Geoapify — SEM rede e SEM escrita:** notebook em [notebooks/Januario_Leads_Proxima_Colab_V1_Preparacao_Geoapify_Offline.ipynb](../notebooks/Januario_Leads_Proxima_Colab_V1_Preparacao_Geoapify_Offline.ipynb), com demonstração offline e modo CSV somente após Fase 0. Em 16/11/2026, a tabela de sugestões Geoapify de homologação tinha **38 tentativas anteriores, todas `no_match`**; o notebook exclui IDs já tentados e prepara no máximo 25 candidatos, sem transferir dados entre ambientes. [Detalhes](COLAB-PROXIMO-LOTE-GEOAPIFY-2026-11-16.md). Esta preparação **não libera API paga, Colab de execução real, importação, backup nem publicação**; o próximo marco de desenvolvimento segue **Fase 3.1a**.

## 6. Próxima ação única e retomada
**AGORA: FASE 3.1a — revisar OFFLINE atribuições, condições de licença e proveniência Overture/Geoapify/Google, NOTICE da interface e armazenamento/eliminação de dados externos, sem consultar provedores pagos ou modificar o banco.** A 2.6a concluiu testes sintéticos de guards com cap financeiro zero no código (inclusive OpenAI Instagram web desativado por padrão), não uma prova de faturamento real. **A Fase 2 continua sem aceite E2E autenticado**: 2.1b/2.2b/2.3b/2.4b/2.5b/2.6b aguardam a conclusão da Fase 0 e a validação de RLS, rollback, custos e integração real. Não publicar, ativar APIs pagas, migrar dados nem lançar beta até esses portões.

**QUANDO O USUÁRIO VOLTAR AO COMPUTADOR: retomar a FASE 0.1 e 0.2 imediatamente**, confirmar revogação da chave `service_role` de homologação exposta e concluir backup/ensaio de restauração da produção. Sem isso, nenhuma migração, beta público, assinatura ou lançamento comercial pode ser considerado aprovado. A implementação atual da busca na homologação foi atualizada para usar preferencialmente `sb_secret_` (Edge Function v31), mas isso **não revoga a chave antiga**.

**Registro de decisão:** nenhum dado real foi movido da homologação para produção durante esta auditoria; nenhum endpoint ou Colab foi alterado.
