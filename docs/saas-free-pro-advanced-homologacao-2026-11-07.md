# Januário Leads — Free, Pro e Advanced no Staging

**Data:** 07/11/2026  
**Branch:** `feature/saas-entitlements-advanced-20261107` — PR #86 (draft).  
**Base:** PR #85, que depende do #84. Código da busca com cotas foi trazido do PR #83.

## Entrega desta etapa

| Área | Free | Pro | Advanced |
|---|---|---|---|
| Novos leads/dia via `search-places` Staging | 5 | 25 | 70 |
| Busca normal / CRM em lista | ✓ | ✓ | ✓ |
| Mensagens prontas e follow-up manual | ✓ | ✓ | ✓ |
| Kanban e editor de mensagens personalizadas | — | ✓ | ✓ |
| Oportunidades, fila comercial e financeiro | — | ✓ | ✓ |
| Relatórios comerciais usuais | — | ✓ | ✓ |
| Pontuação/priorização de leads e painel avançado | — | — | ✓ |
| Relatórios avançados, tendências e comparativo por segmento | — | — | ✓ |
| Agendamento automático interno, opt-in | — | — | ✓ |
| Envio automático de WhatsApp ou e-mails | — | — | — |
| Checkout, cobrança, webhooks e renovação | — | — | — |

A priorização é uma heurística explicável baseada no CRM, **não** IA preditiva. A automação do Advanced cria **tarefa interna** ao passar um lead para `waiting`; jamais envia mensagens.

## Backend e proteção

1. As quotas são aplicadas no servidor pelo `search-places` (JWT + `private_access`, preflight e `claim_daily_leads_for_user`), deduplicadas por Place ID e reiniciadas em 00h Brasília. Uma empresa já desbloqueada não consome novamente a quota.
2. A função `get_my_saas_entitlements` responde o plano efetivo, preço, flags e saldo; a UI só renderiza menus/ações cujo plano está autorizado.
3. A função SQL `saas_my_feature_enabled`, protegida por `auth.uid()`, é utilizada em políticas RLS de pagamentos recebidos no CRM (`lead_payments`) e nas configurações de automação. Um trigger de `leads` bloqueia a gravação/alteração de `project_value` e `financial_notes` no Free.
4. O Advanced pode configurar `saas_automation_settings` e o trigger `saas_schedule_waiting_followup` cria uma tarefa interna quando o status muda para `waiting` sem tarefa existente.
5. Código de verificação de plano também foi incorporado em `deep-enrich-business` e `open-now-niches`, para bloquear o Free quando tais funções forem implantadas. **Não foram implantadas no Staging nesta etapa**: dependem de infraestrutura/credenciais externas e validação de custos. A busca normal no Staging funciona com dados fictícios sem Google Places.

**Não considerar gating visual uma fronteira de segurança.** Dados como `leads.project_value` continuam fazendo parte da representação de `leads` acessível ao próprio usuário; leitura desses campos não foi isolada em um endpoint separado. Antes da venda, é necessário garantir o isolamento completo das APIs financeiras e dos recursos premium em todos os endpoints. Operações de gravação financeira estão bloqueadas para Free na camada SQL.

## Simulação sem pagamentos

A Edge Function `staging-plan-preview` valida o JWT real da conta, consulta `private_access` e permite selecionar Free, Pro ou Advanced **somente no projeto Staging**. A operação é exclusiva do usuário autenticado e grava uma assinatura fictícia `provider=staging_preview` sem intermediar pagamento. O seletor no dashboard dispara reload após mudança. Chaves administrativas ficam exclusivamente no backend; é compatível com `SUPABASE_SECRET_KEYS` e a chave legada. Quando se escolhe Free, a assinatura fictícia é removida.

A homologação requer uma conta de teste **autorizada no Supabase Staging**, não credenciais da produção. A prévia Vercel usa variáveis `VITE_` isoladas para esta branch.

### Teste manual recomendado

1. Abra o link do último build **READY** da branch, faça login na conta autorizada de Staging e acesse `/app`.
2. Selecione **Free**. Confirme 5 leads/dia, carteira em lista, textos prontos em Mensagens; sem Financeiro, Kanban, Oportunidades, editor personalizado nem painel Advanced.
3. Selecione **Pro**. Confirme 25 leads/dia, Oportunidades, Kanban, Mensagens editáveis, fila comercial, Financeiro e relatórios comuns.
4. Selecione **Advanced**. Confirme 70 leads/dia e painel "Inteligência e automações". Ative a regra após 3 dias; coloque um lead de teste no status Aguardando e atualize para conferir tarefa automática. Compare segmentos e pontuação heurística.
5. Use a pesquisa fictícia do Staging para verificar 5/25/70 desbloqueios e paginação; confirme que novas buscas são bloqueadas no saldo zero, mas leads anteriores continuam visíveis.
6. Teste logout, expiração de JWT, segunda identidade sem `private_access` e repetição de leads.

## Verificações realizadas

- Banco Staging: migrations de features, automação e RLS aplicadas.
- SQL transacional executado sem erro (`supabase/staging/tests/20261107_saas_gates_automations.sql` e `supabase/staging/tests/20261107_verify_saas_search_quota.sql` do PR #83). Inclui Free negado, Pro autorizado, Advanced + follow-up, quotas/duplicatas, todos com ROLLBACK.
- ACL: `anon` não executa `saas_my_feature_enabled`; `authenticated` não executa `claim_daily_leads_for_user`; `service_role` mantém a RPC; automação tem RLS e 4 policies.
- `search-places` Staging está ACTIVE v3 e seu código foi comparado ao desta branch.
- `staging-plan-preview` está ACTIVE v3, JWT exigido e suporta chaves secret atuais.
- Contagem depois dos testes: zero leads, assinaturas, desbloqueios e uso comercial persistido.
- Testes de interface com mocks (Free/Pro/Advanced) adicionados em `tests/browser/saas-plan-entitlements.spec.ts`, a executar com `VITE_SUPABASE_URL=https://prlrxjothrslhswpkoza.supabase.co`. Não basta a compilação da Vercel para considerar esses testes E2E aprovados.

## Pendências antes de comercializar

- Executar **E2E autenticado real** e concorrência, verificação de renovação diária e downgrade em múltiplas sessões.
- Implantar e auditar endpoints premium restantes em Staging, com chaves de teste limitadas e custos conhecidos.
- Isolar por contrato de API toda informação premium cujo acesso só esteja escondido na UI, incluindo alguns campos financeiros de leads.
- Revisar limites de armazenamento/licenciamento de dados Google Places, LGPD, e backup de banco antes de produção.
- Revisar árvore de PRs #83, #84, #85 e #86, conciliar migrações e rodar testes automatizados completos quando franquia do GitHub Actions permitir.
- **Pagamentos continuam deliberadamente fora do escopo**; não existe checkout, gateway ou webhook.
- **Nunca fazer merge direto na produção apenas com base no build READY.**
