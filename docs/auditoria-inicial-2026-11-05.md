# Auditoria técnica inicial — Januário Leads
**Data:** 05/11/2026  
**Origem:** `main` @ `0a6168d26774d5cd57ab015db39fc297ef9042fd`  
**Destino das correções:** branch `audit/fix-responsive-test-and-deploy-docs-20261105`  
**Ambiente:** Github + metadados de Supabase de produção (consultas de **leitura** apenas)  
**Regra operacional:** não fazer merge, deploy, migrations ou mudanças de produção sem autorização.

> Este é o primeiro ciclo da auditoria, **não** uma certificação de segurança do SaaS. Os achados distinguem fatos observados, risco e decisões de produto. Não foram examinados integralmente os 269 arquivos.

## 1. Mapa arquitetural resumido

`src/routes/` (TanStack Start/Router + React + TypeScript) → componentes e funcionalidades em `src/components/` e `src/features/` → cliente REST de `src/lib/auth.ts` e serviços por módulo → PostgREST/Supabase Auth, `private_access` e RLS → Edge Functions `search-places`, `deep-enrich-business`, `open-now-niches` e provedores externos.

- `src/features/leads/`: persistência remota do CRM, fila local de mutações pendentes, atualização de leads.
- `src/features/messages/`: modelos de mensagens personalizados; armazenamento local por usuário.
- `src/features/lead-activities/`, `lead-finance/`, `next-actions/`: eventos, pagamentos registrados pelo CRM e próximas ações.
- `src/features/search-leads/`: busca por município e nicho. **Abertos Agora** é um filtro na tela de resultados, não item do menu e não gera outra consulta apenas ao alternar.
- `src/features/opportunities/`, `business-presence/`, `business-enrichment/`: oportunidades, presença na web, confirmação manual e enriquecimento sob demanda.
- `src/lib/bff-*.server.ts`: experiência **opcional** de autenticação com sessão cifrada em cookie HttpOnly. O modo default no código é cliente direto; a flag efetiva do frontend publicado **não foi verificada**.
- `supabase/migrations/`, `supabase/baseline/`, `supabase/tests/`: estrutura SQL e ensaios de isolamento; um baseline separado não substitui conciliação de migrations históricas.
- `.github/workflows/`: testes em PRs e pushes; publicação de determinadas Edge Functions somente via ação/tag explícita.

## 2. Evidências da baseline

1. GitHub `main`: commit acima, **269 arquivos** versionados. `AGENTS.md` avisa que histórico Git já publicado está ligado ao Lovable; não reescrever nem fazer force-push.
2. CI de `main`, [run 42097078377](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/42097078377), **falhou** na etapa `Testar navegador com backend simulado`. Outra execução anterior, [42094836305](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/42094836305), teve a mesma falha. O run da versão anterior [42092769415](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/42092769415) passou.
3. Logs do job `127489809118`: **117 testes Deno aprovados**; nove casos `tests/browser/responsive.spec.ts:118` expiraram esperando o botão lateral `Abertos Agora` (larguras 320–1920 px), removido intencionalmente na evolução do produto. Trata-se de **teste desatualizado** comprovado; não prova um defeito de layout em nove resoluções.
4. Jobs de `Restaurar esquema e validar isolamento` passaram nas execuções citadas. São testes com PostgreSQL descartável e fixtures, não prova de autorização ponta a ponta em produção.
5. Consulta read-only no Supabase: **17 tabelas** `public` com `rls_enabled=true`; existem funções `claim_api_request_for_user(uuid,text)` e `claim_open_now_refresh(...)` com `security_definer=true` e ACL de `EXECUTE` restrita a `postgres`/`service_role`. Isso **não prova** que todos os relacionamentos e fluxos tenham sido testados.
6. Supabase: **51 versões** no ledger remoto, **24 migrations** na pasta local e **27 remotas sem arquivo ativo local**, em consonância com a documentação existente. Evitar `db push`/`db reset` remotos, reparo artificial do ledger e reaplicação indiscriminada.
7. Há **8 Edge Functions** com status ACTIVE. Quatro são stubs confirmados no código implantado que retornam HTTP 410 `FEATURE_REMOVED`: `generate-site-prompt`, `generate-preview`, `analyze-visual-references`, `capture-visual-reference`. Não reativar sem decisão de produto.
8. `sync-leads-daily`: expressão `0 */8 * * *`, **active=false**. `sync-leads` permanece implantada com `verify_jwt=false`, mas sua implementação exige autorização de cron alternativa em `authorizeCron`. Não assumir vulnerabilidade apenas pelo flag nem reativar a função.
9. Consulta de políticas e GRANTs do banco de produção, **somente metadados**:
   `lead_payments` SELECT; `open_now_niche_cache` SELECT; e
   `places_search_cache` SELECT/INSERT/UPDATE conferem proprietário
   (`auth.uid()=user_id`), mas **não** verificam o registro correspondente
   em `private_access`. Esses GRANTs existem para `authenticated`.
   Portanto, há uma lacuna verificável entre revogação do acesso ao app e
   políticas de API para dados próprios, enquanto o JWT continuar válido.
   Não foi executado acesso de usuário real nem constatado vazamento entre contas.
10. O README descrevia incorretamente que o workflow de deploy só publicava `search-places`, nunca executava validações em push e configurava `OPENAI_API_KEY` via CI. O YAML atual observa pushes seletivos para testes e publica **três** funções somente por execução manual ou tag: `search-places`, `deep-enrich-business`, `open-now-niches`; **não** injeta o secret da OpenAI.

## 3. Achados e backlog priorizado

| ID | Classificação | Gravidade | Evidência | Recomendação | Status |
| --- | --- | --- | --- | --- | --- |
| JL-001 | Defeito confirmado: teste de navegação obsoleto | **Alta operacional** | CI em `main`; `tests/browser/responsive.spec.ts:22-30,70-83,118-137` | Remover a entrada descontinuada da matriz e testar sua ausência no menu móvel | **Corrigido na branch; aguarda CI e revisão** |
| JL-002 | Defeito confirmado: instruções de deploy desatualizadas | Média | `README.md` seção Implantação versus `.github/workflows/deploy-search-places.yml` | Alinhar gatilhos, funções publicadas, gestão de secrets e precauções | **Corrigido na branch** |
| JL-003 | Risco potencial: teto global de gasto ausente na estratégia atual | **Alta para lançamento SaaS** | `supabase/functions/search-places/index.ts` usa `claim_api_request_for_user`; `open-now-niches/index.ts` usa até 140 por usuário/localidade/15 min | Inventariar todos os caminhos pagos e implementar **orçamento global servidor-side** além de quotas individuais; falha segura, sem reativar cron | **Planejar; depende de orçamento e política por conta** |
| JL-004 | Risco regulatório/contratual a verificar | **Alta para lançamento SaaS** | `src/features/opportunities/places-search-cache.ts` persiste resultados e metadados de empresas em JSON; Google Places limita cache e reutilização, com exceções, entre elas Place IDs | Revisar termos/licenciamento, necessidade de exibição, atribuição, retenção e permissão comercial; não supor que RLS autoriza armazenar dados do provedor | **Pendente de revisão jurídica/técnica** |
| JL-005 | Lacuna comercial confirmada | Alta para abertura ao público | Login via Supabase Auth + `private_access`; `lead-finance` refere-se a recebimentos dos próprios leads | Especificar onboarding, revogação, regras de planos, direitos de uso e cobrança **separada do financeiro do CRM** | **Decisões do proprietário necessárias** |
| JL-006 | Risco potencial/limite de segurança de sessão | Média | `src/lib/supabase-config.ts`, `auth.ts`, `bff-*.server.ts` | Verificar a flag real da Vercel; realizar testes reais em homologação com cookies, CSRF, refresh e logout antes de adotar HttpOnly | **Não ativar em produção agora** |
| JL-007 | Risco operacional confirmado | Alta para migrations | 51 migrations remotas vs. 24 locais; docs `database-recovery.md` e `migration-history-audit.md` | Planejar conciliação em homologação com backup e dry-run; nunca executar histórico indiscriminadamente | **Sem qualquer DDL executado** |
| JL-008 | Capacidade legada exposta/consumo potencial | Média | Edge Function `open-now-niches` continua ACTIVE mesmo fora da navegação; endpoint exige auth e limites por usuário | Decidir se manter por compatibilidade ou descontinuar com plano de rollback; **não** desligar sem autorização | **Decisão pendente** |
| JL-009 | Risco potencial de telemetria | Média | `src/lib/error-capture.ts` expande `error.stack` e causas antes de registrar no log | Auditar redaction e contratos de logging; verificar se stacks contêm URLs/tokens em cenários reais, adicionar testes antes de alterar pipeline | **Somente investigação** |
| JL-010 | Cobertura parcial de isolamento entre contas | Média | `PrivateWorkspace` monta `LeadFlowApp key={userId}`; `account-storage` separa caches; existem testes simulados e SQL | Executar testes de duas contas com backend real de homologação, incluindo troca de usuário durante requisições pendentes | **Pendente de homologação** |
| JL-011 | Defeito de política confirmado; impacto potencial de revogação | **Alta de autorização** | `pg_policies` e `information_schema.role_table_grants` em produção: `lead_payments`, `open_now_niche_cache`, `places_search_cache` verificam dono, mas não `private_access` | Restringir as políticas às contas com allowlist ativa; validar em conta revogada no banco descartável e homologação; **não executar sobre produção sem revisão** | **Proposta SQL não executável preparada** |

**Documentação externa consultada para JL-003/JL-004:**

- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing/
- https://developers.google.com/maps/documentation/places/web-service/policies

A cobrança depende dos campos/SKUs solicitados e da utilização agregada por projeto. Os termos de uso têm restrições específicas sobre armazenar dados do Places; a exceção para Place IDs não equivale a uma licença irrestrita para persistir todos os demais campos.

## 4. Mudanças feitas neste incremento

- `tests/browser/responsive.spec.ts`: remover `Abertos Agora` da lista do menu; introduzir teste de ausência no drawer móvel e existência de `Buscar Leads`, sem executar API externa.
- `README.md`: descrever o workflow real e manejo privado dos secrets do Supabase, sem exigir uma nova chave paga nem alterar funções.
- `docs/auditoria-inicial-2026-11-05.md`: este relatório de evidências e backlog.
- `docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt`: proposta SQL isolada de execução para revisar revogação.

Nenhuma interface, login, política RLS de produção, Edge Function, cron, banco, cliente ou assinatura foi alterada neste ciclo. A proposta RLS existe somente como documento .sql.txt.

## 5. Baseline de testes e verificações

**Executado/observado nesta auditoria:** leitura da `main`, logs reais de CI, leitura de código-fonte, introspecção de metadados de PostgreSQL (RLS, ACL de funções, triggers e índices), listagem das Edge Functions, migrations e cron; leitura das quatro funções legadas de produção. Os logs preexistentes provam 117 testes unitários Deno passados e a falha dos nove casos responsivos no commit-base.

**A executar após esta mudança:** CI da PR com Playwright, Deno, TypeScript, build, testes responsivos Firefox/WebKit e teste de banco descartável. Se houver falha, coletar os logs e distinguir regressão da branch e problemas preexistentes. **Não declarar aprovação antecipada.**

**Não executado:** login real em contas de usuários, testes reais de Google Places/OpenAI, consumo de quota, DDL e deploy de produção, simulação de pagamento, pentest completo, restauração de um backup real ou auditoria completa de acessibilidade e mobile.

## 6. Operações de produção e reversão

- Nenhuma operação de escrita, DDL ou deploy foi autorizada ou executada.
- Revisão proposta em PR, sem merge automático. Para reverter, fechar a PR, ou reverter os commits após aprovação específica; não é necessário restaurar dados.
- `sync-leads-daily` deve permanecer desligado; a antiga função continua disponível mas **não foi chamada**.

## 7. Próximos incrementos recomendados

1. **Recuperar CI verde** e garantir teste de regressão do fluxo real Buscar Leads → nicho → resultados → Abertos Agora.
2. **Corrigir a lacuna de revogação em RLS**, após testes descartáveis e aprovação de migração explícita, preservando acesso dos usuários autorizados.
3. **Auditar custos e licenças de todos os endpoints pagos** e definir orçamento máximo global antes de habilitar assinaturas.
4. **Validar isolamento entre contas em homologação real** e política de `private_access`; não confundir autenticação com direito de acesso.
5. **Especificar autenticação/comercialização**: inscrição, planos, créditos, limites, cobrança e revogação antes de escolher provedor ou construir tabelas.
6. Auditar telemetria, acessibilidade, concorrência e desempenho; reconciliar migrations com segurança em ambiente descartável.
7. Definir destino das Edge Functions legadas e do endpoint `open-now-niches` sem apagar dependências históricas.

Este relatório será atualizado em outro incremento quando houver resultados adicionais. Não pressupõe autorização para publicação ou gastos.
