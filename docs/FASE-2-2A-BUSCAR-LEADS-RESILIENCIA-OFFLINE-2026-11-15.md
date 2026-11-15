# Januário Leads — Fase 2.2a: continuação, estados vazios, cota, cache e concorrência (offline)

**Data da execução:** 15/11/2026. **Código auditado:** GitHub `wesleyshoto702-hub/januarioleads`, branch da PR #167. **Ambientes Supabase:** nenhuma alteração na homologação ou produção; não foram feitas chamadas reais de negócio.

**Bloqueio P0 preservado:** revogação comprovada da `service_role` de homologação anteriormente exposta e backup/restauração efetiva da produção continuam pendentes. **Nenhum deploy, migração, Colab, consulta paga, dado real ou sessão autenticada utilizados nesta fase.** Todos os testes trabalham com dados fictícios e APIs substituídas por mocks.

## 1. Problema crítico encontrado e correção preparada

A função `search-places/index.ts` classificava qualquer token de continuação que não começasse com `overture:` ou `geoapify:` como paginação Google. Isso fazia um valor desconhecido ou incorreto chegar ao caminho `textSearch`, que pode reservar créditos e iniciar uma consulta externa **se a configuração e o orçamento permitirem**.

Criado `supabase/functions/_shared/search-continuation.ts`, um parser puro, compartilhado com backend e frontend. São admitidos:
- Primeira pesquisa sem token.
- `overture:20`, `:40`, `:60` e `:80`.
- `geoapify:20`, `:40`, `:60` e `:80`.
- `google:<cursor_opaco>` explícito e não vazio, com limite e sem controles.

Qualquer token desconhecido, de outra família, com deslocamento inválido, excesso de caracteres ou estrutura corrompida retorna **`INVALID_REQUEST` antes da execução de `textSearch`**. O cliente também bloqueia token inválido sem fazer `fetch`. Essa proteção reduz requisições desnecessárias; **não proíbe consultas Google legitimamente autorizadas** pela configuração, não prova custo zero em produção e não substitui a auditoria de orçamento da Fase 3.

## 2. Regras reais de interface reforçadas e testadas

| Situação | Conduta preparada no código | Evidência offline |
|---|---|---|
| Paginação Overture normal | 20 registros por página e máximo de 5 páginas / 100 resultados | Leitor `searchOverture` com 125 candidatos fictícios |
| Tentativa de página 6 (offset 100) | Rejeitar sem ler o banco | Teste confirma zero chamadas adicionais |
| Token incorreto | `INVALID_REQUEST`, não usar Google como fallback | Parser + HTTP simulado; contagem de chamadas externas zero |
| Duplo clique em `Carregar mais` | Iniciar uma consulta para o mesmo token; liberar nova tentativa após resposta | `search-request-gate.ts` + Promise simulada |
| Resposta de busca mais antiga | Descartar, mesmo que complete depois | `SearchRequestGate` usado pelo componente |
| Cache de cota chegando atrasado | Não substituir nova busca iniciada enquanto se lia o cache | Gate confirmado por resposta atrasada |
| Pesquisa sem candidatos | `Nenhuma empresa encontrada nesta base` | Módulo `search-empty-state.ts` usado pela UI |
| Filtros excluem todos os itens carregados | Mensagem específica de filtros, sem sugerir inexistência de negócios na cidade | Testes com resultados presentes e visíveis 0 |
| `Abertos Agora` sem registros conhecidos | Não tratar horário desconhecido como fechado ou aberto | Estado vazio independente |
| Busca em progresso ou erro | Não mostrar estado vazio enganoso | Teste de precedência do status |

Os controles de UI permanecem vinculados às funções testadas e ao código real; não se trata de uma implementação paralela dos filtros.

## 3. Cache de resultados e privacidade dos provedores

O cache antes mantinha até 60 resultados, mas podia preservar um cursor correspondente a uma página posterior, pulando parte dos registros intermediários ao recuperar a busca.

Criado `src/features/opportunities/open-search-cache-policy.ts` e integrado em `places-search-cache.ts` e `SearchLeadsView.tsx`. Agora:
- Apenas registros declarados como Overture/Geoapify com ID de origem correspondente podem ser guardados ou restaurados. Resultados Google são excluídos do cache e da recuperação.
- Cursores Google, tokens inválidos e outros cursores não abertos não podem ser persistidos para reprodução.
- Até **60 IDs distintos** podem compor o snapshot; se houver truncamento, o `next_page_token` salvo vira `null` para evitar que o usuário pule resultados.
- Se a API responde `QUOTA`, a interface só utiliza snapshot com **mesma cidade, UF, nicho e timestamp interpretável**, contendo algum resultado de fonte aberta. Esse snapshot é exibido como resultados anteriores, **não** como consulta atual, e não oferece paginação.
- A sessão local também sanitiza a origem dos registros e o token de continuação ao salvar/restaurar.
- Persistência do cache continua auxiliar: falhas não devem impedir a pesquisa principal. A validação de isolamento real por RLS e contas distintas só ocorrerá depois da Fase 0.

**Observação:** o histórico anterior podia ter valores não normalizados; registros incompatíveis serão ignorados pela nova política. O estado de cache não é certificação de qualidade ou existência de empresa.

## 4. Testes automatizados e critério de aceite

- `tests/fase2_2a_search_resilience_offline.test.ts`: parser de tokens, bloqueio pré-HTTP, limite de 100, 125 empresas fictícias, 5 páginas, estados vazios, concorrência, duplo clique, cota, cache permitido/proibido, 60 registros e falha de paginação.
- `tests/test_fase2_2a_search_contract_offline.py`: prova que a UI e a Edge Function utilizam realmente os módulos testados; verifica preservação de estado e que o caminho de Google só ocorre após validação do token.
- Atualizada a asserção de concorrência da Fase 2.1a para o `SearchRequestGate` reutilizado no componente.
- `.github/workflows/fase2-2a-search-resilience-offline.yml` executa os testes 2.2a, regressões 2.1a/1.5 e verificação TypeScript, sem permissões de rede ou segredos.
- O build SaaS usa seu workflow independente; **CI específico e build devem estar verdes antes de integrar a PR**.

## 5. Escopo remanescente — não confundir teste com deploy

- [x] Testes offline e código preparado de paginação, corridas de requisição, estados, erro e quota.
- [x] Cache por fonte aberta, token válido, data/localização e limite; sem dados Google salvos.
- [ ] **Fase 2.2b:** verificar no navegador autenticado a renderização, cache após atualização/relogin, RLS, contas distintas, latência real, desconexões e limite de páginas — **bloqueada pela Fase 0**.
- [ ] Corrigir testes de navegador HttpOnly com API simulada e o histórico de reconciliação de migrations do CI geral antes de liberação.
- [ ] **Fase 2.3a:** revisar linguagem e contadores dos filtros em testes/UI offline: “Com WhatsApp” é só formato compatível; “Sem site” significa site não identificado, “Instagram confirmado” exige evidência, e contadores cobrem somente resultados já carregados.
- [ ] Confirmar a revogação da chave exposta e ensaio de backup/restauração; nenhuma feature offline substitui essa obrigação.

**Decisão:** 2.2a = código preparado e testes offline; nenhuma funcionalidade foi implantada nas Edge Functions publicadas. Seguimos 2.3a para textos e contagens honestas em modo offline. Os testes autenticados 2.1b e 2.2b aguardam a Fase 0.
