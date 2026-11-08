# Januário Leads — Maps → CRM e créditos entre fontes (STAGING)

## Resultado para o usuário
1. **Geoapify/OSM:** o botão "Adicionar ao CRM" guarda os dados do estabelecimento retornados pela fonte (nome, endereço, município/UF, latitude/longitude), ID de origem e a atribuição exigida pela Geoapify/OSM. Sem contatos inventados.
2. **Google Places:** também existe "Adicionar ao CRM", mas o usuário precisa informar um **nome próprio**. O cadastro permanente guarda apenas o Google Place ID, o nome que o usuário digitou e dados próprios gerados no CRM. Os nomes, endereços, contatos e coordenadas exibidos pelo Google não são copiados automaticamente ao CRM. O Place ID pode ser usado para solicitar dados atuais no futuro.
3. **Aviso "Lead já adicionado":** resultados de ambos os buscadores consultam o CRM do próprio usuário. Quando há identidade confirmada pelo mesmo ID, ou pela regra conservadora de nome/localização, o cartão é identificado e a gravação duplicada fica desabilitada.

## Créditos no servidor
- Carteira diária compartilhada: busca tradicional **1 crédito por lead**; Advanced Maps **2 créditos por lead**.
- O mesmo ID no mesmo dia não é cobrado outra vez. O backend aceita a equivalência **Google ID ↔ Geoapify ID** somente quando verificável no servidor, por nome normalizado igual, mesma UF/município e coordenadas próximas (até 80 m); se faltam coordenadas, o endereço precisa coincidir integralmente, assim como cidade/UF.
- As equivalências ambíguas entre estabelecimentos distintos **não** recebem isenção automática. Quando não é possível verificar (API indisponível, lugares não encontrados dentro das páginas verificadas, mudança de grafia, endereços diferentes), o sistema pode tratar como leads diferentes e debitar normalmente, para não permitir isenções não comprovadas.
- Os leads previamente **salvos no CRM** também são consultados na identificação, mesmo depois da virada do dia. IDs Google salvos e dados OSM/Geoapify do próprio CRM alimentam a conferência sem persistir informações Google. A existência do lead antigo gera o aviso "Lead já adicionado" quando verificado, mas **não dispensa os créditos de um novo dia** se ele não havia sido contabilizado naquele dia.
- IDs podem ser armazenados. Para a conciliação, metadados Google são usados **somente em memória durante a consulta** e nunca inseridos na tabela de equivalências. Os metadados Geoapify/OSM são armazenados por dia em `saas_daily_geoapify_anchors` para conferir Google depois de Geoapify.
- `claim_daily_leads_for_user_with_aliases` grava aliases verificados com `charged_credits=0` na tabela `saas_daily_credit_leads`; `claim_daily_maps_with_osm_anchors` faz crédito e registro de âncoras OSM **na mesma transação**. A validação fica restrita ao usuário, data e origem, com RPCs acessíveis somente a `service_role`, cotas monetárias próprias por API e trava por usuário/dia.
- Se a consulta de histórico necessária à verificação falhar, o backend falha sem descontar créditos. Uma verificação Google extra no caminho Geoapify é condicionada à existência de Google IDs já cobrados hoje; permanece sujeita ao orçamento separado.

## Restrições de licença
- Google Places (New): https://developers.google.com/maps/documentation/places/web-service/policies . O armazenamento permanente de Google Place IDs é expressamente permitido; armazenamento de nomes, endereços e avaliações do Google tem restrições importantes. Cadastro Google é feito com nome **fornecido pelo cliente**, não com dados da API.
- Geoapify: https://www.geoapify.com/terms-and-conditions/ ; atribuições `Powered by Geoapify` (plano gratuito) e `© OpenStreetMap contributors`. Avaliar ODbL/uso comercial e termos aplicáveis antes de liberar a funcionalidade na produção.
- As políticas dos provedores e o licenciamento ainda merecem revisão final antes de ativar em clientes reais.

## Implementado e verificado
- Supabase **staging** `prlrxjothrslhswpkoza`: migrações `20261108210000_verified_cross_provider_credit_aliases.sql` e `20261108211500_atomic_verified_maps_claim.sql`.
- `search-places` versão **12** e `geoapify-places` versão **14**, ativas com verificação JWT.
- Testes SQL transacionais reversíveis em `supabase/staging/tests/20261108_cross_provider_credit_aliases.sql`: repetição 0 crédito, dedupe nos dois sentidos, ID não comprovado cobra, Pro Maps bloqueado, registro OSM atômico.
- Testes unitários Deno `supabase/functions/_shared/cross-provider-identity.test.ts` e navegador `tests/browser/maps-leads-pro-advanced.spec.ts` foram adicionados, mas **a execução integral de Playwright ainda precisa ser confirmada**.
- PR #94 em branch isolada, sem merge na main; **nenhuma alteração no Supabase de produção**.

- Teste adicional `supabase/staging/tests/20261108_crm_cross_provider_history.sql` executado com `ROLLBACK`: confirmou que leads salvos três dias antes são recuperáveis para detecção e não consomem crédito ao serem consultados.
- Migração complementar `20261108214500_cross_provider_identity_saved_crm.sql` instalada somente no Supabase de testes.
