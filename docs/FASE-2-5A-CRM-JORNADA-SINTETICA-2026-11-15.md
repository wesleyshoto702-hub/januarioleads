# Januário Leads — Fase 2.5a: jornada completa do CRM com empresas fictícias

**Data-base:** 15/11/2026. **Escopo:** GitHub, testes sintéticos em Deno/Python e validação TypeScript do build SaaS. Nenhuma consulta real ao Supabase, Overture, Geoapify, Google, login ou CRM de usuário.

**Fase 0 continua ADIADA/NÃO RESOLVIDA:** a chave `service_role` de homologação previamente exposta ainda não tem revogação comprovada; backup de produção e teste de restauração permanecem pendentes. **Nenhuma escrita em homologação/produção, deploy, migração, Colab, Lovable, Vercel ou consumo de provedor externo** nesta etapa.

## 1. Código real inspecionado

| Etapa da jornada | Função/arquivo original revisado |
|---|---|
| Buscar → Salvar empresa | `src/routes/app.tsx`: `addFoundLeadConfirmed`, `buildFoundLead`, `SearchLeadsView.onAddLead` |
| Identificar duplicata | `src/features/search-leads/identity.ts`: `findBusinessDuplicate` |
| Favoritar / remover | `src/routes/app.tsx`: `toggleFavorite`, botões em `LeadPresentation.tsx` |
| Alterar status | `src/routes/app.tsx`: `changeStatus`; `next-actions.ts`: `clearActionForStatus` |
| Definir próxima ação | `saveNextAction`, `getLeadActionSummary`, `LeadNextActionSection.tsx` |
| Abrir WhatsApp / confirmar envio | `openWhatsApp` e `confirmWhatsAppSent` em `app.tsx` |
| Persistência e recuperação | `pending-leads.ts`, `remote-leads.ts`, `mutation-queue.ts`, `use-lead-workspace.ts` |

**Escopo da prova:** os testes rodam funções puras reutilizadas pelo aplicativo e fakes de persistência; não exercitam RLS, sessão real, resposta do banco, React renderizado ou WhatsApp real.

## 2. Falhas identificadas e correções preparadas (sem deploy)

### 2.1 Dois salvamentos simultâneos de uma empresa

O código verificava `findBusinessDuplicate(business,leads)` **antes** de aguardar `flushPendingLeads` e `saveRemoteLead`. Duas chamadas antes do retorno poderiam ambas ver a lista antiga e criar dois IDs distintos.

Criado `src/features/leads/found-lead-save-gate.ts`, usado diretamente no `addFoundLeadConfirmed`, com chave por **`placeId`** e, quando nome/endereço/município/UF estiverem conhecidos, chave secundária conservadora por esses campos. **Telefone nunca é identidade exclusiva**: redes e filiais podem compartilhá-lo. Requisições equivalentes em curso compartilham a mesma promessa; salvamento confirmado é reconhecido no workspace até exclusão explícita; falha permite retry. A exclusão limpa o registro e o logout reinicia o controle. A geração de sessão protege o controle contra conclusão tardia de um salvamento da conta anterior.

**Limitação crítica:** trava **somente no navegador e no workspace montado**. Não garante unicidade entre dois dispositivos, abas independentes, operações manuais ou transações concorrentes no servidor. A Fase 2.5b deverá testar a restrição de identidade/owner, RLS, gravação atômica e isolamento real após a Fase 0. Não adicionar um índice `UNIQUE` no banco sem primeiro verificar conflitos históricos e necessidade legítima de filiais distintas.

### 2.2 Provedor original incorreto no histórico

O evento `lead_added` registrava `provider: "google_places"` para **tudo exceto Geoapify**, inclusive leads de origem Overture. Alterado para **`business.source ?? "unknown"`**, não inventando origem. O campo CRM `source:"places-search"` permanece por compatibilidade com a aplicação; a fonte efetiva é preservada como `placeId` e metadado da atividade, sem reescrever eventos antigos.

### 2.3 Instagram promovido para alta confiança sem evidência

`presenceFromBusiness` antes convertia Instagram sem confiança explícita em `high` e podia definir `google_places` só porque existia um `placeId`. Isso distorcia o score e a decisão do usuário, particularmente com dados Overture.

A transformação agora é uma função pura em `business-presence/presence-transform.ts`, reexportada por `storage.ts` para preservar compatibilidade. Perfil sem confiança explícita fica **`medium`**, com revisão pendente, e fonte **`existing_data`** quando não há informação legítima da origem. Confiança `high` e `manual_confirmation` explicitamente preenchidas continuam preservadas. O código `buildFoundLead` foi extraído do `app.tsx` para módulo testável, com relógio/ID sintéticos.

**Nota:** confiança média, alta, manual ou por diretório **não equivale** a verificação oficial do Instagram. Não foi acessado o Instagram para confirmar titularidade.

### 2.4 Favoritos, status e próximos contatos

`next-actions/crm-journey.ts` contém transformações sem efeitos colaterais, importadas pelo CRM:
- alternar `isFavorite` sem alterar origem, ID, notas, contatos ou outros campos;
- mudar status via `clearActionForStatus`, incluindo limpeza de follow-up incompatível com `accepted` e todas as próximas ações ao marcar `rejected`;
- criar/alterar/remover `nextActionType`, `nextActionDate`, `nextActionNotes` com a mesma forma de dados do formulário;
- atualizar `lastContact`, status e lembrete de **5 dias** apenas pelo fluxo de **envio confirmado manualmente** (`confirmWhatsAppSent`), jamais pelo simples clique de abrir WhatsApp.

A confirmação continua exigindo persistência remota antes da atualização do estado local, seguindo o código preexistente. O teste offline valida transições, **não prova que a mensagem foi entregue**.

## 3. Evidências offline e testes

Arquivo: `tests/fase2_5a_crm_journey_offline.test.ts`. Casos planejados:
1. Buscar → construir lead com fonte, data, ID, telefone internacional e endereço corretos.
2. Preservar confiança, revisão e proveniência reais do Instagram.
3. Identidade por `placeId` ou nome+endereço+município/UF, mas não pelo telefone compartilhado.
4. Três tentativas de salvar a mesma empresa/alias em paralelo → **uma gravação simulada**; exclusão permite refazer.
5. Troca de conta fictícia durante gravação em curso → conclusão antiga não contamina novo controle.
6. Falha remota simulada → lead não aparece como salvo, permite retry.
7. Favoritar/desfavoritar, status, próxima ação, aceito/recusado preservam outros campos.
8. Abrir WhatsApp não registra contato; confirmação explícita agenda follow-up 5 dias depois.
9. Fila de mutações confirma **revision exata** e não perde edição feita durante envio.
10. Conta trocada/falha no envio não descarta mutações pendentes.

`tests/test_fase2_5a_crm_contract_offline.py` verifica estaticamente que o CRM **usa essas funções reais**, preserva gates de autenticação e só confirma WhatsApp após a ação específica do usuário.

GitHub Actions `.github/workflows/fase2-5a-crm-jornada-offline.yml` executa Deno comportamento sintético `--no-check` (os tipos da camada `remote-leads` dependem do DOM e da aplicação), teste estático Python e regressões 1.5, 2.1a–2.4a. **O build TypeScript do SaaS é o verificador de tipos oficial da aplicação** e deve passar antes de integrar a PR.

## 4. Pendências para o lançamento

- [x] **2.5a — Fluxo CRM offline com dados fictícios e correção de riscos**, após CI/build aprovados.
- [ ] **2.5b — Validação autenticada real:** gravar, editar, favoritar, status, fila, data do próximo contato, concorrência, múltiplas abas e contas **em ambiente seguro**, com RLS, isolamento e rollback confirmados. **Bloqueada pela Fase 0**.
- [ ] Validar no banco restrições de unicidade por usuário e origem, inclusive filiais com mesmos telefones e endereços.
- [ ] Inspecionar histórico já registrado com `provider:"google_places"` apesar de `placeId:"overture:..."`; não fazer correção em massa sem backup e rastreabilidade.
- [ ] Verificar que cache/localStorage, filas pendentes e resultados anteriores não persistem após logout/troca real de conta; testes Deno não demonstram isso.
- [ ] Investigar falhas antigas de CI geral (nicho, HttpOnly, browser/migrations), separadas da jornada offline.

**Próxima ação segura após 2.5a:** **Fase 2.6a — testar fail-closed de Geoapify/Google e provar, com mocks, que buscas Overture e ações de CRM não acionam fornecedores pagos quando orçamento = 0.** Demonstração de **0 chamadas reais pagas** exige depois a Fase 0 e provas na configuração/telemetria do servidor.

**Condição de aceite:** código no GitHub, workflow offline e build SaaS verdes; não significa que o site publicado já utilize o novo código.
