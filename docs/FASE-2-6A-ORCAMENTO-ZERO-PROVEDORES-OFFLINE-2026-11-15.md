# Januário Leads — Fase 2.6a: provedores externos fechados por padrão (testes OFFLINE)

**Data-base:** 15/11/2026 | **Escopo:** PR no GitHub; simulações determinísticas sem chamadas reais a bancos, provedores ou dados de usuários. **Não comprova ausência de gastos nos serviços atualmente publicados.**

**Fase 0 continua ADIADA/NÃO CONCLUÍDA.** A antiga `service_role` de homologação exposta ainda não possui revogação comprovada; backup restaurável/teste real de restauração de produção pendentes. **Não publicar** este código no Supabase, executar scripts de Colab, tocar na produção, liberar beta ou aceitar pagamento até resolver os portões.

## 1. Rotas reais auditadas

| Caminho | Dependência externa | Antes do `fetch` | Regra na Fase 2.6a |
|---|---|---|---|
| Buscar, página Overture | Base Overture **interna no Supabase** | Leitura PostgREST controlada | Continua funcional independentemente das autorizações de Geoapify/Google |
| Primeiro fallback Geoapify | Geoapify geocoding **e** Places | Chave + `GEOAPIFY_SEARCH_DAILY_CAP` positivo + reserva atômica **separada** para cada operação | Sem chave/cap/reserva: **não executar o pedido** |
| Google complemento/continuação | Google Places **Text Search Enterprise** | Chave + cap Google positivo + `GOOGLE_PLACES_SPEND_APPROVED="true"` + reserva SKU via `claim_saas_google_api_budget` | Sem qualquer requisito: **não executar o pedido**; token Google inválido não acessa provedor |
| Enriquecer lead com detalhes | Google Places **Place Details Enterprise** | Reserva atômica **antes** do GET, independentemente do enriquecimento/busca anterior | Rejeição/exceção/missing RPC: **não executar o pedido** |
| Instagram opcional — busca por IA | OpenAI `responses` com `web_search`, potencialmente faturável | Agora exige flag `OPENAI_INSTAGRAM_WEB_SEARCH_SPEND_APPROVED="true"`, cap de elegibilidade positivo `OPENAI_INSTAGRAM_WEB_SEARCH_DAILY_CAP` **e** reserva atômica `claim_saas_openai_web_search_budget` | **Desativado por padrão mesmo com `OPENAI_API_KEY`**; a RPC ainda não existe nesta fase e portanto deve negar a chamada |
| Instagram em site público | GET em website público | Validação de destino público e limites próprios | Não é chamada a Geoapify/Google/OpenAI, mas não é necessariamente custo zero de infraestrutura/egress; fora da prova de APIs pagas |
| CRM — salvar, favoritar, status e próximo contato | Supabase Data API próprio | Autenticação/filas já existentes | Nenhuma dependência direta de consulta Geoapify/Google/OpenAI no caminho CRM |

### Código implementado

- `supabase/functions/_shared/external-provider-execution.ts`: `runReservedExternalCall(reserve,request)`; **executa a solicitação somente se `reserve()` resolver exatamente `true`**. Exceção, RPC ausente, retorno falso, erro de conexão: nega. Retorno `false` não consome a função de request.
- `_shared/external-provider-approval.ts`: `approvedExternalPlacesDailyCap` permanece fonte de verdade para caps Geoapify/Google; `mayContactExternalPlacesProvider` valida **também** a presença da chave. Caps ausentes, `0`, inválidos e acima do limite de inteiro seguro são negados, mesmo quando a chave exista. Google requer autorização literal `true`. `approvedInstagramWebSearchDailyCap` exige cap numérico de elegibilidade e autorização explícita.
- `_shared/geoapify-search.ts`: geocodificação e consulta Places agora usam o wrapper de reserva **imediatamente antes** do transporte; sem `reserveCredit` continua negado. Uma cidade em cache não pula a reserva de Places.
- `search-places/index.ts`: Text Search e Place Details do Google foram conectados diretamente ao wrapper; cada requisição/página/SKU reserva de forma independente usando os RPCs atuais. Fallback Geoapify/Google consulta a decisão de elegibilidade no módulo puro. **Nenhum fallback pago ocorre apenas por não haver resultados Overture** se o cap estiver zero.
- **Achado adicional:** `runPresenceDiscovery` tinha rota OpenAI web search que podia ser chamada com uma chave válida sem um opt-in financeiro próprio. Agora o `fetch` pago usa a guarda com **claim atômico obrigatório**. **Não foi criada a função SQL `claim_saas_openai_web_search_budget` nesta etapa**. Portanto mesmo habilitar variáveis não comprova autorização; sem RPC válida ela deve retornar `false` e o acesso continua bloqueado.
- **Correção de confiança:** URL de Instagram sem `instagramSource` não vira mais automaticamente `google_places`/alta confiança na Edge; fica como `existing_data`, `medium` e revisão pendente, em coerência com o CRM da Fase 2.5a.

## 2. Testes repetíveis, sem tráfego externo

Arquivos:
- `tests/fase2_6a_zero_paid_providers_offline.test.ts`
- `tests/test_fase2_6a_paid_provider_contract_offline.py`
- `.github/workflows/fase2-6a-zero-paid-providers-offline.yml`

Cenários com chaves **fictícias**, empresas fictícias, crédito falso e `fetch` interceptado:
1. Cap ausente, zero, negativo, decimal, malformado, string vazia ou inteiro inseguro é negado.
2. Mesmo com chave e cap positivo, Google exige `GOOGLE_PLACES_SPEND_APPROVED="true"`.
3. Reserva falsa ou exceção do banco → **zero execução de função de request externa**.
4. Overture com 20 empresas falsas responde via leitura interna, com **zero chamadas externas** se os caps Geoapify/Google são `0`.
5. Cap e aprovação presentes, mas reserva recusada → **zero chamadas externas**.
6. Google busca, detalhes, paginação e enriquecimento **não compartilham um crédito por fluxo**: reservam por operação.
7. Chamada direta ao helper Geoapify sem reserva e geocodificação com reserva negada → nenhuma conexão de rede; `fetch` é interceptado no teste.
8. Chave OpenAI e flag de aprovação incompleta → negar. Mesmo cap positivo, RPC atômico falso → negar.
9. Tokens Google/Geoapify inválidos → não iniciar chamadas.
10. Contratos estáticos **nas funções reais** exigem que as promessas enviadas ao `fetch` passem por `runReservedExternalCall`, e que as rotas Overture e CRM não sejam dependentes de provedores pagos.

Validação:
```sh
deno test tests/fase2_6a_zero_paid_providers_offline.test.ts
deno check tests/fase2_6a_zero_paid_providers_offline.test.ts
deno check supabase/functions/search-places/index.ts supabase/functions/_shared/geoapify-search.ts
python -m unittest discover -s tests -p test_fase2_6a_paid_provider_contract_offline.py -v
```

O CI também executa regressões offline 2.2a, 2.4a e 2.5a. Se algum desses comandos falhar, a Fase 2.6a não será declarada concluída.

## 3. O que os testes NÃO provam

- **Não** foram feitas chamadas reais para verificar custos por provedor, recursos faturáveis ou limites contratados. O número **zero** refere-se somente a requisições interceptadas/negadas nos testes.
- **Não** foi validado o estado real dos secrets, flags ou RPCs de orçamento em staging/produção; não confiar em chaves presentes.
- O cap numérico em variável de ambiente, inclusive o novo da OpenAI, é **apenas condição de habilitação**; **não** constitui contador atômico por dia/projeto. O controle efetivo exige uma RPC que reserve crédito por operação no banco e o apoio de alertas/limites do próprio fornecedor.
- Caso uma operação autorizada falhe após o claim, o crédito reservado pode não ser devolvido; isso é preferível a executar uma operação sem reserva.
- Outros serviços/Edge Functions, jobs, Colab, scripts ou projetos de API podem fazer chamadas externas por outros caminhos não cobertos por este relatório. A auditoria de faturamento e rede real permanece necessária.
- Custos de armazenamento, Supabase, egress e serviços locais **não** são cobertos pelo teste de chamadas aos provedores.

## 4. Portões e sequência

- [x] **Fase 2.6a — código e testes offline:** bloqueio por omissão nas rotas principais Google/Geoapify/OpenAI, condições de elegibilidade sem chave, reserva por operação e regressões; concluída **somente após CI verde**.
- [ ] **Fase 2.6b — ambiente vivo:** após Fase 0, revisar as variáveis reais, buscar consumidores externos além de `search-places`, inspecionar funções SQL e cotas **reais**, garantir operação-only Overture e verificar faturamento/alertas dos fornecedores sem causar custos. Teste autenticado com conta de homologação, navegador mobile e carga controlada. **Bloqueada pela Fase 0**.
- [ ] **Fase 0.5 — auditoria de custo de todo o projeto** e demais pontos de segurança originais.
- [ ] **Fase 3.1a — próxima tarefa segura:** auditoria de documentação, atribuições de fontes, NOTICE e licenças Overture/Geoapify/Google e regras de armazenamento sem migração ou deploy. Verificar regras oficiais atuais antes de sugerir publicação. Essa tarefa pode avançar offline, não desbloqueia o beta.
- [ ] `claim_saas_openai_web_search_budget`: desenhar, revisar e implementar somente depois da Fase 0, com contador atômico por operação/projeto e autorização comercial explícita; **não** criar RPC em etapa offline.

**Estado geral:** apenas código e documentação no GitHub; fases de testes reais do CRM/busca e produção continuam bloqueadas pelas pendências de segredo e backup da Fase 0.
