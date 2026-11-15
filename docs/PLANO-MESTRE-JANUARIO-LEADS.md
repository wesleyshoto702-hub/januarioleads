# JANUÁRIO LEADS — PLANO MESTRE E AUDITORIA DE LANÇAMENTO

**Versão:** 1.0 | **Data-base:** 15/11/2026 | **Ambiente auditado:** GitHub `main`, Supabase homologação e produção, projeto Lovable (somente leitura)
**Objetivo único:** entregar um **Buscar Leads + CRM confiáveis** e um beta pequeno, sem custos inesperados e sem perda dos dados existentes. Depois habilitar comercialização.
**Fonte única de prioridades:** este documento. `docs/roadmap-saas-2026-11-06.md` e planos anteriores são históricos, não listas paralelas de trabalho.

> **Regra central: UMA etapa ativa por vez.** Ideias novas entram no backlog. Para mudar a prioridade, registrar motivo, risco e impacto aqui. Não iniciar novas Colabs, enriquecimentos, refatorações estéticas nem pagamentos durante um bloqueio P0/P1 sem explicar a necessidade.

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

## 1. Visão de entrega — não confundir etapas

**Produto mínimo do beta:** pesquisa real por UF/cidade/nicho → resultados úteis e identificados por origem → filtros verdadeiros → salvar no CRM → favoritar → enviar mensagem manualmente → registrar histórico e próximo acompanhamento. Sem envio automático em massa, sem prometer Instagram confirmado, sem "sem site" como prova, sem consultas pagas.

**Beta limitado** e **lançamento pago** são metas diferentes. Não exigir 600 mil úteis, todos os 216 nichos cheios, automações avançadas, mapas, pagamento ou redesign para o primeiro beta. No lançamento pago, exigir cobrança, direitos de acesso e suporte funcionais.

## 2. Etapas ordenadas e portões objetivos

### FASE 0 — CONTENÇÃO, BASELINE E BACKUP | **PRÓXIMA ETAPA ATIVA** | P0
- [ ] **0.1** Confirmar revogação/rotação da antiga `service_role` comprometida, atualizar todos os usos no Colab/ambientes e verificar que a chave antiga perdeu o acesso. **Nunca enviar credenciais ao ChatGPT ou GitHub.**
- [ ] **0.2** Criar backup recuperável da **produção**, protegendo os **212 leads** e dados associados; testar restauração em ambiente isolado. Verificar o recurso disponível no plano Supabase.
- [ ] **0.3** Registrar versões/commit do frontend, Edge Functions e migrações de cada ambiente, tabela/policies, usuários e volumes, para rollback.
- [ ] **0.4** Revisar RLS para duas contas, chamadas privilegiadas, proteção Auth (senhas vazadas), `sync-leads` e exposição dos endpoints com testes negativos. Não alterar Auth em produção sem plano de reversão.
- [ ] **0.5** Verificar se todo serviço externo faz *deny by default*: nenhuma chamada Google ou Geoapify paga sem aprovação explícita, limite por SKU, usuário e projeto; conferência das faturas reais.
**Sair da fase quando:** chave revogada confirmada, backup restaurável, inventário de deploy e testes de isolamento/autorização aprovados, risco financeiro limitado. **Não pular.**

### FASE 1 — QUALIDADE DO CATÁLOGO OVERTURE | P1
- [ ] **1.1** Fixar conjunto reproduzível de testes por **12–20 pares** de nicho/cidade: capitais, municípios médios, pequenos, casos zero e casos com muitos resultados. Guardar contagens e critérios.
- [ ] **1.2** Medir taxa de registros realmente comerciais, relevante ao nicho, com contato utilizável, duplicações, filial legítima, categoria desconhecida e endereços ausentes. Marcar fonte, lote/release e nível de confiança.
- [ ] **1.3** Verificar os **216 nichos**: **125 mapeados**, **91 pendentes**. Só criar mapeamento com correspondência semântica específica; não prometer cobertura homogênea.
- [ ] **1.4** Classificar regiões/nichos como **cobertura boa / limitada / sem resultados**, sem inventar empresas; não gastar créditos externos para esconder falhas.
- [ ] **1.5** Testar deduplicação baseada em nome, localização e ID, inclusive filiais homônimas e telefones repetidos. Validar telefone BR, website real e Instagram; não chamar dados apenas presentes de "verificados".
**Sair da fase quando:** relatório claro de cobertura e qualidade, 0 misturas flagrantes de nichos e 0 duplicações óbvias nos cenários de regressão. Se a amostra tiver pouca cobertura, **reduzir o escopo inicial anunciado**, não ficar importando indefinidamente.

### FASE 2 — BUSCAR LEADS DE PONTA A PONTA NO STAGING | P1
- [ ] **2.1** Rodar buscas autenticadas reais em desktop/mobile nos cenários da Fase 1; confirmar status de origem, cidade, UF, categoria, paginação e ranking reproduzível.
- [ ] **2.2** Conferir limites de 20 resultados, páginas seguintes, estados vazios, erros de rede/cota e recuperação de sessão.
- [ ] **2.3** Alinhar filtros "Com telefone", "Com WhatsApp", "Com email", "Site não identificado", "Instagram confirmado"/"Instagram possível"; os contadores devem declarar quando valem **só para os resultados carregados**, não para o universo inteiro.
- [ ] **2.4** Medir latência p50/p95, falhas e volume de chamadas; registrar baseline e corrigir gargalos com índices/consultas paginadas no servidor. Não buscar em massa a cada clique.
- [ ] **2.5** Testar CRM com dados fictícios: adicionar, editar, favoritar/desfavoritar, organizar status, recuperar pesquisa, registrar contato e follow-up sem duplicar leads.
- [ ] **2.6** Fechar os provedores externos por padrão; teste integrado deve demonstrar **0 chamadas pagas**.
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
| 0 | Segredos, backup e segurança | **ATIVA — BLOQUEADORA** | nenhuma |
| 1 | Qualidade Overture | parcial, testes SQL realizados | 0 |
| 2 | Buscar Leads E2E staging | código parcialmente pronto, E2E pendente | 1 |
| 3 | Compliance/custos/migração canário | não iniciado | 0–2 |
| 4 | CRM e UX beta | funcionalidades existentes, aceite E2E pendente | 2–3 |
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

## 6. Próxima ação única e retomada
**EXECUTAR FASE 0.1 + 0.2: comprovar rotação da chave secret/service_role de homologação e estabelecer um backup restaurável da produção ANTES de qualquer mudança grande.**

Somente após a fase 0 ser comprovada, iniciar Fase 1 com as 12–20 buscas fixas de controle. A integração e a deduplicação Overture já foram preparadas na homologação (`search-places` versão 30, PR #156), portanto não é necessário recomeçar essa implementação.

**Registro de decisão:** nenhum dado real foi movido da homologação para produção durante esta auditoria; nenhum endpoint ou Colab foi alterado.
