# Januário Leads — Planos e cotas no Supabase Staging

Data: 07/11/2026. Escopo: somente projeto de homologação prlrxjothrslhswpkoza. A produção czkazbianiflhldenhcj NÃO foi alterada nesta etapa.

## Catálogo

| Plano | Mensalidade | Leads novos desbloqueados por dia |
|---|---:|---:|
| Free | R$ 0,00 | 5 |
| Pro | R$ 14,90 | 25 |
| Advanced | R$ 29,90 | 70 |

Reinício de cota: meia-noite America/Sao_Paulo. Reabrir uma empresa já desbloqueada pelo mesmo usuário não consome nova cota. O limite refere-se a leads *desbloqueados* pela pesquisa, não a cadastros manuais.

## Dados e segurança

- saas_plans: catálogo em BRL, leitura pública; modificações apenas backend.
- saas_plan_features: 11 flags de funcionalidades por plano; leitura pública, somente backend modifica.
- saas_subscriptions: registro por auth.users.id, status, período e provedor. Sem assinatura ativa e vigente: Free.
- saas_daily_usage: contador por usuário e dia, bloqueio de linha para evitar ultrapassagem com buscas simultâneas.
- saas_lead_unlocks: IDs de empresas desbloqueadas, deduplicados para o mesmo usuário.
- saas_billing_events: identificador de evento único por provedor; nenhuma cobrança ou webhook está ativo.

Todas as tabelas têm RLS. As assinaturas e os contadores não podem ser alterados diretamente por usuários comuns. A tabela de eventos não tem política nem privilégio para clientes (deliberadamente).

## Funções RPC

- get_my_saas_entitlements(): SECURITY INVOKER, aceita somente usuário autenticado; devolve plano, preço em centavos, cota diária, uso, saldo e flags.
- claim_daily_leads_for_user(user_id, place_ids): SECURITY INVOKER, EXECUTE somente service_role; máximo de 100 IDs por lote; devolve allowed_place_ids, newly_unlocked, used_today, daily_limit e remaining_today. Duplicatas e empresas já liberadas não consomem novamente.

O backend deve validar o JWT e a autorização comercial ANTES de chamar a segunda função. Jamais enviar a service_role ao navegador.

As 11 flags são: crm, basic_messages, manual_followup, kanban, custom_messages, followup_center, finance, lead_enrichment, advanced_reports, internal_automations e advanced_lead_prioritization. Free: 3 habilitadas; Pro: 8; Advanced: 11. Algumas funcionalidades dependem de implementação posterior.

## Validação

Testado em Staging: catálogo, permissões, RLS e leitura autenticada; Free 5, Pro 25, Advanced 70; reabertura de empresa já liberada; cancelamento e retorno ao Free; chamada usando ROLE service_role. Testes que fizeram escritas foram executados em transação com ROLLBACK. Nenhuma conta pagante ou consumo de teste permanente foi criado.

SQL reproduzível: supabase/tests/saas-plan-quotas-staging.sql.

Avisos informativos do advisor: saas_billing_events sem policy para clientes é proposital; índices novos ainda não foram usados porque as tabelas ainda estão vazias. A proteção contra senhas vazadas está desabilitada no Auth de Staging (aviso anterior, não relacionado a estes planos).

## Próxima implementação (AINDA NÃO PRONTA)

1. **Concluído em Staging:** 17 tabelas e 38 políticas RLS do CRM preparadas e comparadas com produção, sem copiar dados. Veja [preparação do CRM](saas-crm-staging-preparacao-2026-11-07.md).
2. Integrar search-places com a RPC de desbloqueio e **filtrar no servidor** os resultados antes de retornar empresas ao navegador, incluindo paginação/cache e enriquecimento. Uma checagem de saldo antes da chamada ao Google também deve evitar gastos desnecessários.
3. Separar limites técnicos de chamadas externas (Google Places e outros) dos limites comerciais de leads.
4. Criar interface de Plano atual, saldo diário e upgrade; conectar os bloqueios de recursos às validações de backend. Ocultar botão não é segurança.
5. Escolher gateway e integrar apenas em Sandbox; validar webhooks assinados, idempotência, vencimento, reembolso, cobrança falha e cancelamento.
6. Testes E2E e multiusuário, backup, migrações conciliadas e aprovação explícita antes de qualquer mudança em produção. A estrutura existente private_access não foi alterada.

Não publicar preços ou funcionalidades ainda não ativas como se o checkout estivesse disponível. O GitHub Actions ainda está sem minutos gratuitos; isso não autoriza merge sem verificação.
