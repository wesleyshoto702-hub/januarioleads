# Januário Leads — Maps → CRM e créditos sem cobrança duplicada (staging)

## Objetivos entregues

- **Geoapify/OSM:** o usuário Advanced pode adicionar ao CRM a empresa encontrada no Maps; nome, endereço, cidade e posição são da fonte Geoapify/OSM, com atribuição `© OpenStreetMap contributors` e `Powered by Geoapify` na interface de resultados.
- **Google Maps:** o usuário pode adicionar ao CRM o **Place ID** e um **nome de contato digitado manualmente**. Nenhum nome, endereço, coordenada, telefone ou site retornado pelo Google é copiado automaticamente para o cadastro via Maps.
- **Avisos bidirecionais:** empresa que já existe no CRM aparece como `Lead já adicionado` nas duas buscas, com bloqueio do botão de adicionar. O servidor envia o `equivalentPlaceId` somente após comparar um registro com histórico pago da outra fonte.
- **Carteira única:** Buscar Leads custa 1 crédito por lead entregue; Buscar via Maps (Advanced) custa 2. Para a mesma empresa previamente debitada no **mesmo dia**, o backend registra um alias verificado por 0 crédito extra. Um nome igual isolado nunca autoriza desconto zero.
- **Contabilidade transacional:** `claim_daily_leads_for_user_with_aliases` e `claim_daily_maps_with_osm_anchors` serializam o saldo por usuário/dia e nunca debitam créditos negativos. A versão Maps grava a âncora Geoapify do local pago na mesma transação do débito.
- **Comparação limitada:** o servidor confere identidade por nome normalizado mais endereço exato ou coordenadas a até 80 metros e município/UF compatíveis, exigindo correspondência um-para-um. Um local que não possa ser verificado continua sujeito à cobrança normal, evitando falsos descontos. O mecanismo usa apenas dados Google transitórios e armazena exclusivamente IDs do Google.

## Arquivos e versões

- `src/features/maps-leads/MapsLeadsView.tsx`: ação Adicionar ao CRM para Geoapify e cadastro Google com nome manual; aviso de empresa salva.
- `src/features/search-leads/identity.ts`: equivalência entre IDs sem mesclar metadados do Google e OSM.
- `supabase/functions/_shared/cross-provider-identity.ts`: verificação única em memória.
- `supabase/functions/search-places/index.ts` e `supabase/functions/geoapify-places/index.ts`: débito e aliases verificados pelo servidor.
- Migrações: `20261108210000_verified_cross_provider_credit_aliases.sql` e `20261108211500_atomic_verified_maps_claim.sql`.
- Staging Supabase: `search-places` v12 e `geoapify-places` v14 ACTIVE com JWT. Supabase produção intacto.

## Validação e limitações

- Testes SQL `supabase/staging/tests/20261108_shared_credit_wallet.sql` e `supabase/staging/tests/20261108_cross_provider_credit_aliases.sql` executados com sucesso via transações `ROLLBACK`: nenhum crédito real consumido.
- Testes unitários Deno de correspondência e E2E Playwright com API/CRM simulados foram adicionados, mas ainda **não executados integralmente** nesta sessão.
- A verificação Geoapify → Google pode exigir chamadas adicionais ao Google Places, sempre sujeitas a limites monetários. Se faltar orçamento ou falhar a verificação, não se concede desconto zero sem comprovação. O pareamento depende da cobertura/consistência dos dados dos dois provedores; não é uma garantia universal para todo estabelecimento.
- O Google permite guardar Place IDs, mas restringe o armazenamento e a criação de dados derivados de conteúdo Places. Antes de usar comercialmente, revisar Google Maps Platform Terms e Places policies com suporte jurídico adequado: https://developers.google.com/maps/documentation/places/web-service/policies e https://developers.google.com/maps/documentation/places/web-service/place-id
- Geoapify permite cache/armazenamento sob condições e atribuição obrigatória de OpenStreetMap e, no plano gratuito, Geoapify: https://www.geoapify.com/terms-and-conditions/
- Alterações somente na branch `feature/maps-one-click-auto-staging-20261108`; nenhum merge na main, nenhuma alteração no gateway de pagamentos e nenhuma migração em produção.
