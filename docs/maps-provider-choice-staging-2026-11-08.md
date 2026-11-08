# Maps: escolha explícita de Geoapify ou Google Places — staging

## Implementação

- Branch: `feature/maps-provider-choice-staging-20261108` (sobre `feature/geoapify-google-hybrid-staging-20261108` / PR #91).
- Somente **staging** apresenta o seletor Geoapify / Google Places. Produção mantém a interface anterior até revisão e rollout.
- Geoapify é a opção inicial de staging e faz `POST /functions/v1/geoapify-places` com `action=search` e `mapMode=true`; exige sessão, plano com recurso Maps, flag, chave privada e limites da fonte.
- Google é consultado **somente** após seleção e envio de uma nova busca, ou clique intencional no botão `Buscar no Google Places` exibido quando Geoapify não tem resultados.
- No Google Places, a chamada envia `mapMode=true` ao `search-places` **sem `stagingDemo=true`**. Resultado fictício de staging nunca substitui uma resposta de busca real. Se a chave Google do servidor não estiver configurada, a UI mostra `NOT_CONFIGURED` sem inventar estabelecimentos.
- Cada fonte devolve listas separadas; alternar fonte limpa resultados anteriores sem emitir requisição. Resultado Geoapify não vira `Google Place ID`.
- Geoapify mostra apenas nomes e endereços com atribuição obrigatória (Geoapify + OSM) e link de localização OpenStreetMap. Google mostra lista isolada, identificação `Google Maps` e links do Google disponíveis na resposta.
- **Nenhuma origem** permite adição ao CRM durante a homologação em staging. Há restrições de armazenamento e importação de conteúdo Google Maps, que precisam de análise antes de release público.
- O fundo cartográfico de staging é explicitamente ilustrativo **sem marcadores inventados**. A lista apresenta dados reais retornados pela fonte; não atribui esses dados a posições fictícias. O mapa Google só é renderizado onde existe sua chave pública e ambiente de produção com permissão apropriada.
- Geoapify em Lavras/MG não possui barbearias nas categorias testadas: o fallback apresenta opção de Google por ação explícita; nunca busca ambas fontes automaticamente.
- Ao acionar uma segunda busca, o orçamento e a franquia específica do fornecedor são reavaliados pelo backend; não é uma repetição gratuita do mesmo crédito.

## Testes adicionados/atualizados
`tests/browser/maps-leads-pro-advanced.spec.ts` cobre:
1. Acesso Maps oculto para Free.
2. Uma única chamada Geoapify ao clicar Buscar, **zero chamadas Google** até a ação de fallback.
3. Uma chamada Google **real**, com `stagingDemo` ausente, somente ao clicar alternativa; resultado source-specific.
4. Proibição de importação CRM e atribuição no modal/lista.
5. Geoapify com empresas reais simuladas (sem Google) e link OSM.
6. Chave Google ausente mostra erro, nunca fixture.
7. Selecionar outra fonte sem clicar Buscar não aciona fornecedor.

## Limitações antes do lançamento
- **Nenhum dado fictício serve como evidência de cobertura.** Uma consulta Google real depende da API key privada e dos limites habilitados no Supabase de staging. Testes Playwright com `page.route` mockam a rede e não cobram a API.
- Os testes devem ser executados e a interface revisada no Vercel Preview configurado exclusivamente para staging. Builds automáticos Vercel não substituem `npm run typecheck` e Playwright.
- Confirmar licenciamento de Google Places no produto SaaS/CRM. Google tem restrições de cache, armazenamento e redistribuição, e exige atribuição se os resultados forem exibidos sem Google Map: https://developers.google.com/maps/documentation/places/web-service/policies
- Geoapify/OSM requer atribuições conforme os planos e condições: https://apidocs.geoapify.com/docs/maps
- O endpoint original do Google, a cobrança, as cotas e os dados de produção **não foram modificados**. Os resultados em estágio são apenas de consulta (sem exportação nem salvamento).
