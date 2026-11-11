# Buscar via Maps — motor híbrido de estabelecimentos

Data: 11/11/2026 · Conta pessoal

## O problema

O Geoapify/OpenStreetMap podia retornar zero empresas mesmo quando o município possuía estabelecimentos reais. O frontend só permitia consultar Google Places quando `VITE_GOOGLE_MAPS_BROWSER_KEY` estivesse presente. Isso confundia a **chave necessária para exibir um Google Map** com a **chave privada do Places usada para buscar empresas**.

## Implementação

A mesma Edge Function `geoapify-personal`, no Supabase original, agora recebe `priority: "geoapify" | "google"` e controla ambas as fontes, sem depender da Vercel:

- Padrão: **Geoapify primeiro → Google Places quando o Geoapify falha, não retorna resultados ou retorna apenas negócios de classificação incerta**.
- Opção do usuário: **Google Places primeiro → Geoapify se o Google não retornar empresas ou estiver indisponível**.
- A operação reserva **uma única busca da cota pessoal de 10/dia**, independentemente da ordem e das fontes usadas.
- Não há chamadas Google se o Geoapify encontrar registros claramente categorizados na ordem padrão.
- O Google usa `GOOGLE_PLACES_API_KEY`, privada, configurada **somente no Supabase**, com `places:searchText`. A máscara pede apenas Place ID, nome, endereço, componentes de endereço, localização e link Google Maps. **Não solicita telefone, website, reviews ou detalhes**; consultas Google podem ter cobrança, mesmo com esta máscara econômica.
- Resultados Google são filtrados pela cidade e UF brasileiras solicitadas. Nada é inventado nem misturado entre as duas fontes.
- Só a conta proprietária original, também validada em `private_access`, pode acessar a Edge Function. Não há formulários de chave no painel nem segredos no frontend.

## Separação legal do mapa

Google Places permite listagens sem mapa Google sob regras de atribuição, mas proíbe apresentar resultados Places sobre um mapa não Google.

- Empresas de Geoapify/OSM continuam no **mapa MapLibre/OpenFreeMap** com marcadores.
- Empresas Google ficam no **Google Maps JS** apenas quando houver uma chave pública de navegador configurada uma vez para o site.
- Sem a chave de navegador, resultados Google aparecem em **painel de listagem com atribuição explícita Google Maps e links para abrir cada estabelecimento no Google Maps**. O OpenFreeMap não é renderizado neste estado, nem recebe marcadores Google.
- Se Google Maps JavaScript falhar durante a exibição, mantemos os resultados e passamos ao painel com atribuição, em vez de apagá-los.
- Dados Google não são persistidos no CRM: ao adicionar, mantém-se apenas o **Place ID** e um rótulo derivado das entradas próprias de nicho e cidade do usuário. O fluxo Geoapify/OSM preserva a origem e o cadastro nos campos permitidos.

## Segurança e limites

A chave pública de mapa é **opcional** e não deve ser confundida com `GOOGLE_PLACES_API_KEY`, que nunca vai ao navegador. Google Places possui cobrança por uso, mesmo que a busca apresente zero empresas; configure restrições de API, quotas e alertas de orçamento no Google Cloud. A cota atual no Supabase limita tentativas a 10/dia para a conta proprietária, mas não substitui as restrições de faturamento no Google Cloud.

O fallback não garante cobertura total de todos os nichos em todos os municípios. O conjunto de 196 nichos do catálogo segue reconhecido pelo frontend e pela fonte aberta, e o texto de busca Google usa o mesmo catálogo. As fontes são apresentadas **separadamente**, nunca sobrepostas sobre um mapa não licenciado.

O Overpass comunitário continua apenas para ausência de **ambas** as chaves. Se Google Places estiver configurado e Geoapify não, a busca evita uma espera desnecessária no Overpass.

## Testes e homologação

- Confirmar pré-publicação que a Edge Function aceita a nova opção de `priority`, exige login de proprietário, mantém cota diária, não expõe chave e tem `verify_jwt=true`.
- Validar na interface buscas com e sem resultados do Geoapify e o modo Google primeiro. Conferir atribuição, listagem sem mapa, links individuais, fallback e CRM.
- Confirmar no Supabase o retorno de erros `NOT_CONFIGURED`, `GOOGLE_AUTH`, `BILLING_REQUIRED` ou `QUOTA` quando pertinentes.
- **Não é possível homologar com dados reais sem a sessão autenticada do proprietário.** Deploy ativo não significa que os resultados Google foram comprovados no navegador.
- GitHub Actions pode estar sem capacidade de executar testes. Nenhuma consulta Google é disparada apenas pelo deploy.

Referências oficiais:

- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
- https://cloud.google.com/maps-platform/terms/maps-service-terms
