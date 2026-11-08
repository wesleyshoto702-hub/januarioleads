# Januário Leads — Buscar via Maps com busca automática (STAGING)

Data: 08/11/2026 · Base: PR #92 (depende do PR #91, #89 e dos limites Google/Geoapify existentes).

## Experiência do cliente

Um único formulário (segmento, cidade, UF, bairro opcional) e um único botão **Buscar no mapa**. Sem alternador de APIs nem botão Google extra. O cliente vê até 20 empresas por pesquisa, com a fonte devidamente creditada. Na versão atual, o mapa ilustrativo foi removido. Com a chave pública restrita da Maps JavaScript API configurada no ambiente Vercel Preview, o cliente vê um **Google Maps real**, com pins numerados nas coordenadas do provedor que respondeu. Ao selecionar o pin a lista rola até o local e o card traz detalhes. Ao selecionar um item da lista, o mapa centraliza. Se faltar a chave de navegador, aparece um aviso de configuração sem desenhar marcadores inventados. A lista de empresas reais continua disponível.

## Orquestração / segurança

Apenas em Supabase staging `prlrxjothrslhswpkoza`, Edge Function `geoapify-places`:
1. Requer JWT válido, `private_access`, permissão `maps_search` do plano Pro/Advanced e URL do projeto de staging.
2. Valida nicho conhecido, cidade/UF e bairro sem começar consulta paga.
3. Faz `saas_free_search_quota(...,p_claim=true)` **uma vez** e `claim_api_request_for_user(...,places_search)` uma vez para o clique. Não chama a função Google `search-places` separadamente na segunda fase.
4. Sem bairro, havendo nicho Geoapify revisado: reserva até 1 geocoding + 1 Places municipal + 1 Places por raio de 10 km, separadamente. Nunca procura uma categoria genérica no lugar da solicitada. Para **Barbearia**, restringe resultados hairdresser a nomes claramente relacionados a barbeiro/barbearia; nomes ambíguos seguem ao Google para evitar falsos positivos.
5. Se encontrar negócios Geoapify úteis, retorna até 20 (fonte e atribuição Geoapify/OpenStreetMap).
6. Senão, ou se nicho não for mapeado, bairro for informado, API Geo falhar ou faltar orçamento Geo, reserva **uma** consulta `text_search_pro` na proteção Google existente e executa Places (New), Text Search, com máscara de campos sem telefone/site/avaliação. Busca Google ocorre automaticamente no mesmo clique e mesma Edge Function.
7. A resposta Google preserva Place ID, localização e atribuição Google Maps; descarta municípios/UF diferentes, limita a 20, não busca dados Enterprise e não desbloqueia/insere contatos. Em staging o CRM fica inativo para ambas as fontes, por cautela com licenciamento.
8. Sem credencial Google, orçamento ou cobertura de ambos, retorna erro/vazio real — **nunca inventa empresas, nem promete resultados garantidos em todas as cidades**. Não há loop de fallback.

### Observações de custo e produto

**Uma pesquisa do usuário não significa uma chamada faturável total.** No pior caso, o mesmo clique reserva até 3 chamadas Geoapify + 1 Google Places Pro; cada provedor mantém seus limites diários/mensais e por usuário. A UI não precisa expor essa complexidade, mas o proprietário deve monitorar consumo e preço. Como o Geoapify pode ter pouca cobertura em certas categorias/cidades, incluir monitoramento de miss-rate e otimizar a escolha de provedor após homologação.

O banco de staging mantém Geoapify em modo piloto (5/dia para geocoding e 5/dia para Places, 4 req/s), e Google continua em `saas_google_api_limits` com controles independentes. Cotas Free de pesquisa permanecem separadas do desbloqueio de leads; o Maps só está disponível Pro/Advanced.

## Arquivos

- `supabase/functions/geoapify-places/index.ts`
- `supabase/functions/_shared/maps-auto-google.ts`
- `supabase/functions/_shared/maps-auto-google.test.ts`
- `supabase/functions/_shared/geoapify-adapter.ts`
- `src/features/maps-leads/MapsLeadsView.tsx`
- `src/features/maps-leads/geoapify-client.ts`
- `src/features/maps-leads/maps-leads.css`
- `src/features/maps-leads/map-points.ts`
- `src/features/maps-leads/map-points.test.ts`
- `tests/browser/maps-leads-pro-advanced.spec.ts`

## Verificação / lançamento

- Confirmar que `GEOAPIFY_API_KEY`, `GEOAPIFY_HYBRID_ENABLED=true`, `GOOGLE_PLACES_API_KEY` e guardrails existem **no staging**. Os nomes/estado de Secrets podem ser conferidos, mas seus valores não devem ir ao GitHub, Vercel público ou chat.
- Executar `npm run typecheck`, `deno test src/features/maps-leads/map-points.test.ts supabase/functions/_shared/maps-auto-google.test.ts supabase/functions/_shared/geoapify-adapter.test.ts` e `npm run test:browser -- tests/browser/maps-leads-pro-advanced.spec.ts` com preview de staging e mocks, além de uma consulta real autenticada sob orçamento.
- Verificar origem Vercel em CORS, o bundle staging isolado e permissões Free/Pro/Advanced. Google Places sem credencial/billing não pode fornecer cobertura real; mostrar erro controlado.
- Não mesclar em `main` nem publicar em Lovable/produção antes de validar E2E, conta paga de testes, billing e licenciamento do Google.
- Google Maps Places: usar logo ou atribuição textual Google Maps legível quando conteúdo exibido fora de Google Maps. Não desenhar pontos Google sobre mapa de outro provedor. Não fazer cache de conteúdo Google salvo exceções documentadas. Exigir Termos de Uso e Política de Privacidade antes do rollout.
- Geoapify/OSM: preservar suas atribuições e condições para exibição/uso dos dados.

Políticas: https://developers.google.com/maps/documentation/places/web-service/policies


## Verificações executadas nesta etapa (08/11/2026)

- Código e testes foram registrados no PR #94 (draft).
- Edge Function `geoapify-places` foi implantada apenas em staging (v8, `ACTIVE`, `verify_jwt=true`), com roteamento automático.
- Foi executado um **smoke test autenticado de infraestrutura**, por uma função temporária privada no mesmo Supabase, que inspecionou **somente a presença das variáveis de ambiente**: `GEOAPIFY_API_KEY` presente, `GEOAPIFY_HYBRID_ENABLED=true` e `GOOGLE_PLACES_API_KEY` **ausente**. Resultado `GOOGLE_KEY_MISSING`; **nenhuma chamada Google foi executada ou cobrada**.
- A função temporária `google-places-staging-smoke` foi substituída por HTTP 410 e o pg_net auxiliar foi removido. A busca Geoapify permanece com sua chave ativa.
- Variáveis de preview Vercel de staging (quatro variáveis `VITE_*` vinculadas à branch) foram configuradas, sem quaisquer secrets Google no frontend.
- A tentativa manual de deploy Vercel da branch retornou **402** `api-deployments-free-per-day`, `retryAfter=86400` (franquia diária mais de 100 deployments). Portanto, o frontend atualizado **não foi publicado nem validado em browser**. Não associar URLs de previews antigos a esta versão.
- Testes Deno e Playwright foram escritos, **ainda não executados**. A busca Google em Lavras/MG só poderá ser testada após configurar a key Google no **Supabase staging**.

### Ação obrigatória antes de homologar

No Google Cloud Console do projeto correto:
1. Ativar a **Places API (New)**; verificar faturamento e limites/alertas de consumo.
2. Gerar uma chave de API exclusiva para o backend de staging, com restrição de API à Places API (New). Não fixar um IP arbitrário de saída para Edge Functions; considerar egress fixo gerenciado se for restringir IP de origem.
3. Salvar **apenas em Supabase staging → Edge Functions → Secrets**, sob o nome exato `GOOGLE_PLACES_API_KEY`, sem prefixo `VITE_`. Não enviar chave no chat/GitHub.
4. Testar com conta Pro/Advanced de staging, confirmar resultados reais em Lavras e que **uma única ação do usuário** resulta em até uma busca Google, além das chamadas Geo admitidas pelo orçamento.
5. Não publicar produção ou Lovable antes da validação E2E e de revisar os termos Google Maps de apresentação/cache/armazenamento.


## Visualização cartográfica real — configuração externa pendente

- O segredo do Supabase `GOOGLE_PLACES_API_KEY` é **somente para chamadas no servidor** à Places API (New). **Não exponha essa chave no Vercel/VITE_ nem use a mesma chave no navegador.**
- No Google Cloud, projeto `januario-leads`, habilitar separadamente **Maps JavaScript API** (`maps-backend.googleapis.com`). Confirmar faturamento, preços e cota de *Dynamic Maps* (cobrança separada de Places Text Search).
- Criar chave de navegador **distinta** com:
  - nome sugerido `Januario Leads - Staging - Maps JS Browser`;
  - restrição de API: **Maps JavaScript API** e nenhuma outra;
  - restrição de aplicativo: **Websites / HTTP referrers**. Incluir apenas a origem estável da branch de preview ou os domínios de homologação realmente usados: `https://januarioleads-git-feature-maps-one-c-0a4489-wesley-s-projects16.vercel.app/*` (confirmar no Vercel após publicar).
- No Vercel, projeto `januarioleads`, criar variável **somente no ambiente Preview e na branch** `feature/maps-one-click-auto-staging-20261108`: `VITE_GOOGLE_MAPS_BROWSER_KEY`. Como é uma chave de navegador, seu valor aparecerá publicamente no bundle, sendo indispensáveis as duas restrições Google acima.
- **Redeploy Preview** da branch após a variável ser criada: variáveis VITE_ são embutidas durante o build. Nunca usar `--prod` nem compartilhar o segredo servidor Places.
- O mapa Google só é carregado depois de haver resultados com coordenadas válidas. Isso evita faturamento de Dynamic Maps em simples visitas à tela sem pesquisa. Não há pins simulados.
- Mostrar atribuição da fonte na lista e manter logos/créditos nativos do Google Maps visíveis. Geoapify/OSM permanecem creditados quando sua fonte é utilizada.
- O teste real do servidor Google Places em Lavras retornou 20 empresas em 08/11/2026. Isso **não prova** que o mapa browser já funciona sem configurar Maps JavaScript API e a chave apropriada; são serviços com quotas diferentes.
- Antes de produção, checar política de uso Google Places, detalhamento no CRM (desativado na homologação), métricas de custo por carregamento do mapa e controles de uso no navegador.
