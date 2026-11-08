# Januário Leads — Buscar via Maps com busca automática (STAGING)

Data: 08/11/2026 · Base: PR #92 (depende do PR #91, #89 e dos limites Google/Geoapify existentes).

## Experiência do cliente

Um único formulário (segmento, cidade, UF, bairro opcional) e um único botão **Buscar no mapa**. Sem alternador de APIs nem botão Google extra. O cliente vê até 20 empresas por pesquisa, com a fonte devidamente creditada. A empresa e sua localização no Google não são desenhadas sobre um mapa ilustrativo de origem diferente. Em staging, a área do mapa continua ilustrativa, e os dados reais ficam na lista.

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
- `tests/browser/maps-leads-pro-advanced.spec.ts`

## Verificação / lançamento

- Confirmar que `GEOAPIFY_API_KEY`, `GEOAPIFY_HYBRID_ENABLED=true`, `GOOGLE_PLACES_API_KEY` e guardrails existem **no staging**. Os nomes/estado de Secrets podem ser conferidos, mas seus valores não devem ir ao GitHub, Vercel público ou chat.
- Executar `npm run typecheck`, `deno test supabase/functions/_shared/maps-auto-google.test.ts supabase/functions/_shared/geoapify-adapter.test.ts` e `npm run test:browser -- tests/browser/maps-leads-pro-advanced.spec.ts` com preview de staging e mocks, além de uma consulta real autenticada sob orçamento.
- Verificar origem Vercel em CORS, o bundle staging isolado e permissões Free/Pro/Advanced. Google Places sem credencial/billing não pode fornecer cobertura real; mostrar erro controlado.
- Não mesclar em `main` nem publicar em Lovable/produção antes de validar E2E, conta paga de testes, billing e licenciamento do Google.
- Google Maps Places: usar logo ou atribuição textual Google Maps legível quando conteúdo exibido fora de Google Maps. Não desenhar pontos Google sobre mapa de outro provedor. Não fazer cache de conteúdo Google salvo exceções documentadas. Exigir Termos de Uso e Política de Privacidade antes do rollout.
- Geoapify/OSM: preservar suas atribuições e condições para exibição/uso dos dados.

Políticas: https://developers.google.com/maps/documentation/places/web-service/policies
