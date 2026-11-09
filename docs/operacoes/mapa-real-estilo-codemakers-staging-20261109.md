# JanuárioLeads — Mapa real com visual escuro, pins e cadastro de leads
**Staging / PR #94 — 09/11/2026 — Não promoveu produção**

## O que foi implementado
- `RealGoogleMap.tsx` desenha **mapa geográfico real usando Google Maps JavaScript API**. Ruas, bairros e municípios vêm de tiles oficiais, nunca de imagens, mockups ou posições sintéticas.
- Ao abrir a seção, o mapa-base mostra uma visão geral do Brasil; após uma busca, `fitBounds` centraliza e ajusta o zoom para os estabelecimentos cujas coordenadas reais foram retornadas.
- **Apenas empresas com latitude/longitude válidas** são colocadas no mapa. O mapa nunca inventa coordenadas; quem não tem GPS permanece na lista.
- Tema de vias escuro via JSON `styles` quando não há ID de mapa. Opcionalmente um `VITE_GOOGLE_MAPS_MAP_ID` público permite marcadores avançados e estilos escuros configurados no Google Cloud. Não misturar `mapId` e estilos JSON.
- Pins vermelhos numerados, com mesmo número das empresas na lista, inclusive quando uma empresa anterior não tem GPS.
- Zoom +/−, clique no pin ou na linha da lista, detalhes flutuantes, botão **X** para fechar e reabertura por nova seleção.
- Botão **Adicionar lead** no card e em todas as entradas da lista lateral.
- Geoapify/OSM: botão da lista salva diretamente no CRM, respeitando verificação contra duplicatas e atribuições OSM.
- Google Places: botão da lista abre o card e dá foco ao campo **Nome que você quer usar no CRM**; só após digitar um nome escolhido pelo usuário é permitido salvar, persistindo Place ID + nome próprio e **não** copiando automaticamente nome, endereço, site, telefone ou coordenadas retornados pelo Google.
- Estado `Lead já adicionado` evita duplicação e marca tanto card quanto lista.
- SDK e marcadores têm proteção contra erros para que uma falha do mapa **não derrube a lista de leads**. Se faltar chave ou ocorrer erro externo, mostra diagnóstico e mantém os resultados acessíveis.

## Configuração obrigatória para mapa real
1. Projeto Google Cloud com faturamento associado e **Maps JavaScript API** habilitada.
2. Criar/restringir **chave de navegador** (não é a chave privada usada pelo backend Places). Autorizar os referrers exatos dos domínios Vercel de homologação e o domínio oficial quando a produção for aprovada. A chave do navegador é pública, portanto restringir APIs e origens.
3. A branch staging já tem `VITE_GOOGLE_MAPS_BROWSER_KEY` configurada no projeto Vercel. A presença da variável **não garante** habilitação da API, permissões, faturamento ou renderização de tiles; inspecionar o Console do navegador se o mapa estiver indisponível.
4. Opcional: configurar `VITE_GOOGLE_MAPS_MAP_ID` (ID de mapa público, não chave) e publicar um estilo escuro no Google Cloud. AdvancedMarkerElement exige um Map ID; na ausência do ID, usamos marcadores SVG e estilização JSON do mapa oficial.
5. Em Google Maps, **Map ID e opção `styles` não podem ser combinados**. O app escolhe automaticamente um dos dois caminhos.
6. Confirmar logo, créditos, licenças, termos e exigências do Google Maps Platform em cada modo de exibição.

**Custo:** a Maps JavaScript API pode cobrar a SKU **Dynamic Maps** a cada carregamento. Esse gasto de renderização no navegador é **separado** das chamadas Places/Geoapify e dos limites internos de crédito que estão pausados em staging. Configurar orçamento e alertas no Google Cloud; o modo testes não torna o mapa gratuito/ilimitado.

## Verificação e pendências
- Testes Playwright adicionados para fechamento/reabertura de card, adicionar da lista Google com nome manual, adicionar OSM diretamente e mapa-base carregando antes da busca com marcadores de coordenadas reais (SDK mockado).
- Testes isolados das funções puras `map-points.ts` (transformações JavaScript a partir do TypeScript): **6/6 aprovados** incluindo preservação da numeração no caso de GPS ausente.
- Verificação estática de integração de frontend e CSS: **15/15 requisitos encontrados e consistentes**.
- **Ainda precisa ser validado em navegador real:** tile renderizado com a chave do Google, visual escuro, pins clicáveis, funcionamento em desktop e celular, domínios autorizados e despesas.
- **Não foi feito:** mudança no Google Cloud, alteração em produção, Supabase/Edge Function, pagamentos, merge para main.

## Referências oficiais
- https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- https://developers.google.com/maps/documentation/javascript/advanced-markers/start
- https://developers.google.com/maps/documentation/javascript/style-reference
- https://developers.google.com/maps/documentation/javascript/cloud-customization/troubleshoot
- https://developers.google.com/maps/documentation/javascript/troubleshooting
- https://developers.google.com/maps/documentation/javascript/usage-and-billing
