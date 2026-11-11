# Mapa interativo definitivo — configuração centralizada, sem chaves por navegador

Data: 11/11/2026

## Alteração no comportamento

Antes, `Buscar via Maps` exibia um aviso para entrar em `Configurações → Administração → Mapa interativo` e preencher uma chave Google Maps JavaScript **em cada navegador**. A ausência dessa chave impedia a apresentação de um mapa.

Agora:

1. O **mapa aberto padrão** usa `MapLibre GL JS` com ruas reais do `OpenFreeMap / OpenStreetMap`. É interativo, dark, permite zoom e seleção dos marcadores existentes. Nenhuma conta ou chave de API de mapas é exigida do usuário. O SDK está versionado no código (`6.17.0`) e carregado sob demanda de CDN; o estilo padrão é `https://tiles.openfreemap.org/styles/dark`. As coordenadas dos estabelecimentos vêm da consulta autenticada já existente a Geoapify.
2. O **Google Maps original é opcional**, ativado *uma única vez na infraestrutura* com `VITE_GOOGLE_MAPS_BROWSER_KEY`, chave pública de navegador, restrita aos domínios e à **Maps JavaScript API** em Google Cloud. Só é usado quando a consulta retorna dados Google Places, preservando as restrições de licenciamento. Se o Google SDK não inicializar ou recusar o domínio, o aplicativo mantém o mapa aberto e impede a exposição de dados Places no mapa de terceiros.
3. Em caso de erro de CDN, WebGL ou tiles, há fallback de mapa geográfico para **OpenStreetMap embed** e opção de tentar o mapa vetorial novamente. O fallback só oferece centralização de um marcador por vez, e o uso de lista/CRM não é afetado.
4. Os controles de zoom continuam funcionando, incluindo uma aproximação no iframe alternativo.
5. O painel administrativo não pede mais nenhuma chave. Mostra apenas o provedor disponível e um botão para abrir o mapa.
6. O campo `VITE_MAP_STYLE_URL`, opcional, permite trocar o estilo para tiles autogerenciados/contratados quando o SaaS crescer. Usar apenas um estilo HTTPS de origem confiável.

## Licenciamento e limites

**Google Places não pode ser apresentado em mapas que não sejam do Google.** Portanto:

- Quando os resultados vierem do Geoapify/OSM, o aplicativo usa **OpenFreeMap**. Resultados Google usam o mapa Google quando configurado ou um painel separado sem mapa.
- Quando a pesquisa aberta não encontrar resultados, o fallback Google Places pode ocorrer usando apenas a chave **privada** Google Places no Supabase. Sem chave pública de mapa no site, os resultados aparecem em **listagem Google Maps com atribuição**, sem carregar OpenFreeMap no mesmo painel. Se a chave pública de mapa existir, os dados Google podem ser exibidos no mapa Google.
- Sem chave pública de mapa configurada, a aplicação **pode acionar Google Places quando Geoapify retornar zero ou falhar**. A busca está sob cota pessoal autenticada e pode ser cobrada pela API Google. Nunca apresenta dados do Places sobre o mapa de terceiros.
- Quando a inicialização do Google Maps JavaScript falha, o aplicativo mantém os resultados Google numa listagem exclusiva atribuída ao Google Maps, sem desenhá-los no OpenFreeMap.
- As políticas existentes do Supabase, a chave **privada** do Google Places e as cotas server-side NÃO são alteradas.

As informações Google Places podem ser exibidas em listagens sem mapa somente com as atribuições adequadas, mas a implementação optou por não renderizar Google Places ao lado do mapa de terceiros.

Fontes oficiais:
- [Google Maps JavaScript API — exige browser key](https://developers.google.com/maps/documentation/javascript/get-api-key)
- [Google Maps Platform Terms — proibição Places sobre mapas não Google](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [OpenFreeMap Quick Start — MapLibre sem API key](https://openfreemap.org/quick_start/)

## Aspectos operacionais

- Nenhum segredo Google foi gravado no GitHub, em `localStorage` pela nova implementação ou no banco.
- A chave pública browser opcional, por definição, fica visível nas requisições do navegador. As restrições por domínio, API, quotas e billing são obrigatórias para proteger os custos; NUNCA reutilizar a chave privada do Google Places do Supabase.
- `VITE_*` é injetado durante o **build** do frontend. Mudanças de env precisam de rebuild/redeploy. O projeto Januário Leads não apareceu na lista de projetos do acesso Vercel disponível nesta conversa; logo, sua variável Google opcional **não foi configurada** por este trabalho.
- A base OpenFreeMap é pública e gratuita no momento, mas é mantida por um terceiro e **não existe SLA de disponibilidade garantida**. Para uma operação pública grande, utilizar um serviço comercial de tiles ou hospedagem própria mantendo a mesma interface do mapa.
- O mapa base não cria empresas: pesquisas por bairro, nicho e cidade ainda dependem dos provedores de descoberta (Geoapify / Google), de cobertura, limites e orçamento.
- A opção **Buscar via Maps** segue privada ao proprietário e não se tornou pública para todas as contas nesta PR. Para expansão comercial, revisar permissões, cotas, antiabuso, licenciamento e política de privacidade antes de habilitar acesso.
- No lançamento, manter a atribuição do OpenStreetMap e do serviço de tiles, monitorar saúde e velocidade dos tiles e configurar uma opção redundante.

## Validação

- Testes Deno de validação do padrão de chave e seleção automática de provedor adicionados.
- Revisão estática dos componentes: sem input de chave, Geoapify e Google não se misturam no basemap, zoom, seleção de marcadores, fallback visual e status.
- **Ainda falta** executar testes/browser e confirmar o deploy Vercel. O histórico do GitHub Actions apresenta runners indisponíveis, com zero steps executados. Merge no GitHub não equivale a mapa testado em produção.

## Atualização posterior

O motor híbrido Google Places + Geoapify foi implementado depois desta revisão inicial. Consulte `docs/maps-hybrid-provider-2026-11-11.md` para a estratégia atual; afirmações antigas que exigiam chave pública de Google Maps para uma consulta Places estão superadas.
