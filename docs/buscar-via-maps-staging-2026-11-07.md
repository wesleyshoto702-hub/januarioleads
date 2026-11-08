# Buscar via Maps — Januário Leads, Pro e Advanced

**Escopo:** implementação isolada no Supabase Staging e branch `feature/maps-pro-advanced-20261107` (PR #87, depende do PR #86). Nenhum gateway ou pagamento foi integrado.

## Experiência

A navegação lateral e o menu mobile exibem **Buscar via Maps** imediatamente abaixo de **Buscar Leads** para planos Pro e Advanced.

- Filtros: segmento reconhecido do catálogo, cidade, UF e bairro opcional.
- Pinos selecionáveis, cartão com empresa/endereço/avaliações/site (quando presentes), lista de empresas, paginação e **Adicionar ao CRM**.
- Aparência escura e vermelha, inspirada no estilo apresentado, sem copiar imagens, marca ou código de terceiros.
- Todos os desbloqueios são processados pelo mesmo `search-places`, mesma cota atômica por Place ID e mesmos limites de requisições do **Buscar Leads**; não existe cota extra só por entrar no mapa.
- A seleção de empresa não cobra uma chamada Places adicional.

## Permissões reais

- Free: `saas_plan_features.maps_search = false`, menu não exibido e endpoint rejeita requisições `mapMode=true` com HTTP 403.
- Pro: `maps_search=true`, limite de 25 leads/dia.
- Advanced: `maps_search=true`, limite de 70 leads/dia.
- O backend valida JWT, `private_access`, flag do usuário e quota **antes de chegar à API do Google**. O frontend é um complemento de UX e nunca a única fronteira de segurança.
- A busca geográfica por bairro refina a consulta textual e **não é uma busca em raio garantido**. Apenas lugares na cidade/UF verificada são liberados.

## Mapas reais x demonstração

1. **Staging sem custos:** o frontend e o backend exibem **empresas fictícias e um mapa ilustrativo**, claramente identificados. Não são coordenadas reais e não representam ruas verdadeiras. O usuário pode testar seleção de pinos e os limites de plano com autenticação autorizada.
2. **Mapa real:** o frontend possui suporte ao Google Maps JavaScript API com estilo escuro e pinos associados às empresas autorizadas. Para habilitar fora do Staging, configurar uma chave **pública para navegador**, em `VITE_GOOGLE_MAPS_BROWSER_KEY`, restrita por HTTP referrers aos domínios autorizados e restrita à API JavaScript Maps. **Nunca publicar `GOOGLE_PLACES_API_KEY` ou chaves Supabase de serviço no frontend**.
3. **Produção sem chave:** a interface não dispara buscas pelo mapa real, apresentando mensagem de configuração necessária. O Google Places permanece na Edge Function com credencial secreta no backend.
4. Google Places exige exibição de seus resultados em **Google Maps quando mostrados em mapa** e atribuições adequadas. Mapa do OpenStreetMap/Leaflet não pode ser usado como base para os lugares da API Places. Veja [regras Places](https://developers.google.com/maps/documentation/places/web-service/policies), [Google Maps terms](https://cloud.google.com/maps-platform/terms/maps-service-terms), [Maps JS](https://developers.google.com/maps/documentation/javascript/overview).
5. Revisar mensalmente SKU/field mask de Google Places e preços do Maps JavaScript API antes de liberar recursos reais para planos econômicos; um limite de 25/70 novos leads **não equivale** ao número de chamadas externas.
6. Respeitar restrições de armazenamento/licenciamento dos dados Google Places, LGPD e política de privacidade.

## Validação e limitações

- Migration `supabase/migrations/20261107234500_saas_maps_search_pro_advanced.sql` aplicada somente ao Staging.
- Edge Function `search-places` Staging ACTIVE v4, JWT obrigatório, valida `maps_search` antes da chamada externa.
- Teste SQL transacional `supabase/staging/tests/20261107_maps_pro_advanced.sql` executado com sucesso; Free bloqueado, Pro e Advanced liberados e quotas respectivas, com ROLLBACK.
- Testes de UI com mocks adicionados em `tests/browser/maps-leads-pro-advanced.spec.ts`, sem chamadas a Google ou produção; execução integral pendente por quota GitHub Actions e/ou Vercel.
- **Ainda pendente:** teste E2E real com login, mapa Google real, chave HTTP-referer, controle de custos, precisão da busca geográfica, interação com leads reais, segurança dos outros endpoints e aprovação antes do merge.
- O PR #87 deve permanecer **draft**. Não publicar em produção nem ativar faturamento nesta fase.
