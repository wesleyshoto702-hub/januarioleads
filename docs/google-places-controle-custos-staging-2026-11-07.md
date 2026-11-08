# Januário Leads — controle de custos Google Places (Staging)

**Estado:** branch `feature/places-cost-guardrails-staging-20261107`; aplicados e testados no Supabase Staging `prlrxjothrslhswpkoza`. Não foi alterada produção, faturamento do Google Cloud, chaves privadas ou gateway de pagamentos.

## 1. Redução dos SKUs com field masks

- **Buscar Leads (lista):** Text Search Enterprise (sem Atmosphere). Mantém nome, localização, website, telefone e avaliações — campos importantes para identificar negócios sem site.
- **Buscar via Maps:** Text Search Pro, apenas nome, ID, categoria, endereço, coordenadas e URL do Google Maps. A ausência de `website` nesta primeira etapa é tratada como **"Website não consultado"**, nunca como "Sem website".
- **Detalhes sob demanda no Maps:** botão explícito "Consultar telefone, website e avaliações" para empresa já desbloqueada, usando Place Details Enterprise. O endpoint `mode=place-details` exige JWT válido, `private_access`, feature `maps_search` e Place ID desbloqueado pelo próprio usuário. Não é chamada automática por clique no marcador.
- **Enriquecimento de CRM:** continua manual para Pro/Advanced e usa máscara Enterprise (sem Atmosphere), com orçamento por chamada externa, inclusive nas tentativas múltiplas.
- **`editorialSummary`:** removido dos field masks para evitar SKU Enterprise + Atmosphere. Descrições opcionais podem ficar vazias.

Fontes oficiais de classificação: https://developers.google.com/maps/documentation/places/web-service/data-fields e https://developers.google.com/maps/documentation/places/web-service/usage-and-billing

## 2. Limites dos leads compartilhados

A função `claim_daily_leads_for_user` continua sendo a única fonte de débito: Free 5/dia, Pro 25/dia, Advanced 70/dia. `search-places` aplica a mesma cota para pesquisas normais e `mapMode=true`. IDs repetidos no mesmo usuário não cobram duas vezes; o saldo renova à meia-noite de Brasília. Teste transacional: `supabase/staging/tests/20261107_places_quota_and_cost_caps.sql`.

## 3. Dupla proteção de requests e fatura

### Rate limit por usuário, por janela de 15 minutos

| Bucket | Pedidos/15 min |
| --- | ---: |
| Busca (`places_search`) | 15 |
| Enriquecimento (`lead_enrichment`) | 8 |
| Pesquisa de presença online (`presence_discovery`) | 6 |
| Verificação de site (`presence_site`) | 24 |
| Enriquecimento profundo (`deep_enrichment`) | 4 |

A função `claim_api_request_for_user` rejeita chamadas excedentes sem incrementar contadores indefinidamente. Somente `service_role` pode chamá-la.

### Circuit breaker por chamada EXTERNA ao Google

Em `saas_google_api_limits`, com RPC de reserva `claim_saas_google_api_budget` antes de cada fetch faturável do `search-places`. Tabelas e RPC protegidas de `anon`/`authenticated`, RLS ativo e lock atômico por operação.

| Operação | Dia — projeto | Mês — projeto | Dia — usuário |
| --- | ---: | ---: | ---: |
| `text_search_pro` | 150 | 3.500 | 12 |
| `text_search_enterprise` | 40 | 850 | 5 |
| `place_details_enterprise` | 40 | 650 | 6 |

Contadores por dia/mês de Brasília. Quando bloqueado, a Edge Function retorna `QUOTA` (HTTP 429) sem consultar a API Google. Valores **iniciais conservadores**, precisam de ajuste conforme margem, tráfego e franquias reais. Em qualquer falha do banco, o backend falha fechado. O orçamento conta tentativas reservadas (inclusive respostas de erro do Google); não é um extrato exato de cobrança. As operações de Google Maps JavaScript no navegador e outros serviços não entram nesses contadores.

Desligamento imediato de uma operação no Staging:

```sql
UPDATE public.saas_google_api_limits
SET enabled=false
WHERE operation='text_search_enterprise';
```

Consulta manual de monitoramento no SQL Editor (acesso administrativo):

```sql
WITH periods AS (
 SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS today,
 date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date AS month_begin
)
SELECT l.operation,l.enabled,l.daily_project,l.monthly_project,
 COALESCE(d.request_count,0) AS requests_today,
 COALESCE(m.request_count,0) AS requests_this_month
FROM public.saas_google_api_limits l CROSS JOIN periods p
LEFT JOIN public.saas_google_api_usage d
  ON d.operation=l.operation AND d.scope='global-day:'||p.today::text
LEFT JOIN public.saas_google_api_usage m
  ON m.operation=l.operation AND m.scope='global-month:'||p.month_begin::text
ORDER BY l.operation;
```

Não usar essas configurações como substitutas das cotas no console Google Cloud.

## 4. Passos no Google Cloud — PENDENTE DE ACESSO À CONTA

**Não foi possível aplicar cotas/alertas diretamente no Google Cloud**, pois esta conversa não tem acesso administrativo ao projeto Google Cloud vinculado à chave Google Places. É necessário que o proprietário execute estes passos:

1. Acesse https://console.cloud.google.com/google/maps-apis/quotas e selecione o projeto correto. Em Places API (New), reduza a cota diária por método quando essa opção estiver disponível (por exemplo, **Text Search até 150/dia e Place Details até 35/dia**, ajustados às outras apps do mesmo projeto). Esses tetos externos são defensivos; ajuste também Map JavaScript API se for ativada.
2. Em https://console.cloud.google.com/billing, selecione a conta de faturamento e crie **Orçamentos e alertas** para o projeto/serviços Google Maps Platform. Escolha um valor mensal compatível com a margem (exemplo inicial: R$ 50 se esta for a meta desejada), e alertas de 50%, 80% e 100%, com e-mails administrativos.
3. Entenda que **alertas de orçamento NÃO interrompem cobranças**, e que orçamento não substitui limite de solicitações. Só a cota configurada pode bloquear requests daquela API; nem toda SKU tem quota direta editável.
4. Restrinja a chave de servidor à Places API (New). Não publique chaves de servidor no frontend. Ao ativar Maps JavaScript, use chave separada de navegador com restrições de domínio/referrer e restrição à API Maps JavaScript.
5. Confira o **Billing Reports** real (pode ter atraso), atualize os limites internos e teste erros de quota antes de liberar usuários.

Documentação: https://developers.google.com/maps/billing-and-pricing/manage-costs e https://docs.cloud.google.com/billing/docs/how-to/budgets

## Validação e pendências

- Testes SQL: `20261107_places_quota_and_cost_caps.sql` (quota compartilhada e circuit breaker) e `20261107_api_throttling_window.sql` (16ª busca bloqueada). Ambos `ROLLBACK`.
- **Nenhuma consulta Google real foi realizada**, por decisão de não gerar despesas na homologação.
- Verificar build Vercel Preview, TypeScript/Deno e fluxo real autenticado com chave de testes antes de merge.
- Endpoint Google Places no Staging deve permanecer com `verify_jwt=true`; as chamadas com `stagingDemo=true` seguem 100% fictícias e não debitam o orçamento externo.
- Google Places em produção NÃO foi modificado. Alterações em produção dependem de revisão do PR, migrações, testes E2E e aprovação explícita.
