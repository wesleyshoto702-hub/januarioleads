# JanuárioLeads — Modo testes sem contagem de créditos

**Estado:** ATIVO **somente na conta autorizada do Supabase Staging** a partir de 09/11/2026.  
**Ambiente exclusivo:** `prlrxjothrslhswpkoza` (Staging).  
**Produção:** não alterada. **Pagamentos:** não alterados.

## Motivo
O produto está em desenvolvimento e atualmente há uma única conta no ambiente de homologação. A pessoa responsável quer experimentar as buscas sem que contadores e acessos de planos limitem a exploração, mas manter toda a infraestrutura de créditos pronta para a ativação comercial.

## Como o modo funciona
O banco contém uma chave reversível, `public.private_access.quota_test_mode`, com valor `true` **apenas para a conta única autorizada no staging**. A coluna não pode ser editada diretamente pelo usuário autenticado, e o teste exige login e `private_access` válido.

Enquanto a chave estiver ativada:
- `saas_free_search_quota(p_user_id,p_claim)` valida o usuário, responde `allowed=true` e `test_mode=true`, **sem incrementar** `saas_daily_search_usage`.
- `claim_daily_leads_for_user_with_aliases` devolve todos os Place IDs válidos da consulta e `credits_spent=0`, sem lançar saldo ou inserir ID nas tabelas diárias de cobrança.
- `claim_daily_maps_with_osm_anchors` usa a mesma isenção para créditos. O registro de âncoras OSM/Geoapify licenciadas pode continuar, pois serve à identificação do estabelecimento e não à cobrança de créditos.
- `peek_daily_leads_for_user` informa saldo de testes suficiente para que a consulta não seja bloqueada.
- `saas_my_feature_enabled` e `get_my_saas_entitlements` autorizam os recursos à conta em modo testes, mantendo o plano real gravado; a interface exibe `Modo testes`.
- `search-places` deixa de mascarar resultados Free por saldo; `geoapify-places` aceita a conta mesmo sem Pro/Advanced. Regras das outras contas (se forem adicionadas) permanecem normais.

**Os registros históricos de crédito anteriores não foram apagados.** A mudança pausa *novos* descontos enquanto o teste estiver ativado.

## O que NÃO foi desligado
- Validação de JWT, controle de acesso, isolamento por usuário (RLS) e regras de CRM.
- Reserva dos custos da API Google Places (`claim_saas_google_api_budget`).
- Reserva de custos e limites por segundo do Geoapify (`claim_saas_geoapify_api_budget`, `claim_saas_geoapify_request_slot`).
- Limite de frequência antifraude (`claim_api_request_for_user`).
- Limites físicos de paginação e tamanho de resposta, validação de município e nicho, regras legais e de conteúdo Google/OSM.
- Políticas de armazenamento, privacidade e deduplicação de registros do CRM.

**Atenção:** sem créditos internos não significa uso ilimitado ou gratuito das APIs. Uma busca ainda pode ser interrompida por limite, preço, erro, ausência de chave ou rate limit dos provedores.

## Arquivos mantidos
- Migração de homologação: `supabase/migrations/20261109144146_staging_single_user_pause_saas_quotas.sql`.
- Funções existentes preservadas com execução alternativa: `saas_free_search_quota`, `peek_daily_leads_for_user`, `claim_daily_leads_for_user_with_aliases`, `saas_my_feature_enabled`, `get_my_saas_entitlements`.
- Edge Functions staging: `geoapify-places` **v16** e `search-places` **v14**.
- Teste SQL com rollback: `supabase/staging/tests/20261109_pause_credits_single_user.sql`.
- Teste de interface adicionado a `tests/browser/maps-leads-pro-advanced.spec.ts`.

## Para reativar créditos e travas de planos
**Não executar em produção.** Quando for retomar cobrança e publicação, primeiro obter autorização, realizar backup, executar E2E e revisar os planos/comercialização. No projeto **Staging**, um administrador pode executar apenas:

```sql
UPDATE public.private_access
SET quota_test_mode = false
WHERE quota_test_mode = true;
```

O código original permanece nas funções e será usado automaticamente quando a chave ficar `false`. Não há necessidade de reconstruir tabelas, reescrever regras ou refazer integrações. O flag permanece disponível para um novo período de testes se necessário. Para verificar:

```sql
SELECT count(*) AS contas_com_modo_testes
FROM public.private_access
WHERE quota_test_mode = true;
```

Retorno esperado após reativação: `0`. Testar em seguida um usuário Free, um Pro e um Advanced no staging, inclusive o bloqueio e a deduplicação de créditos. **A produção não recebe essa migração de homologação automaticamente.**

## Evidência de verificação
Teste SQL com `ROLLBACK` aprovado: duas consultas da cota Free, uma consulta de créditos de lead tradicional e uma consulta de créditos Maps retornaram `test_mode=true`, `credits_spent=0` e todos os IDs; os contadores e o histórico de desbloqueios permaneceram com as mesmas quantidades. O teste desativou a chave dentro da transação, confirmou o retorno às regras normais e restaurou o modo de testes por rollback.

Testes completos de navegador continuam dependentes da execução Playwright/CI. Construção Vercel READY não significa teste end-to-end.
