# Buscar Leads híbrido — Geoapify → Google Places

**Escopo:** apenas a seção já existente **Buscar Leads**, sem qualquer
retorno da seção "Buscar via Maps" e **sem sistema de pontos ou créditos
internos para os usuários**.

## Estratégia

1. A Edge Function autenticada `search-places` confirma conta autorizada,
   nicho do catálogo de 196 opções e cidade/UF brasileira.
2. Para nichos com uma categoria específica confiável no Geoapify, faz
   geocodificação exata da cidade e consulta a **Geoapify Places API** na
   fronteira municipal, com até 20 estabelecimentos por página.
3. Se houver **pelo menos 8 empresas identificadas, 5 delas com telefone
   aproveitável**, usa somente resultados Geoapify, sem consulta Google.
4. Caso contrário (poucos resultados/telefones, timeout, erro, cidade não
   encontrada, chave indisponível ou categoria não mapeável), **Google Places
   Text Search** complementa ou substitui automaticamente.
5. O cadastro no CRM e o restante da prospecção não mudam. Mesmo quando o
   resultado inicial veio do Geoapify, **enriquecimento detalhado** continua
   usando os recursos Google existentes; identificadores Geoapify nunca são
   enviados ao endpoint Google Place Details por engano.
6. Resultados mistos são deduplicados por nome exato + telefone, localização
   próxima ou endereço idêntico. Cada registro mantém **inteiramente sua
   fonte original** (sem mesclar campos de fornecedores com licenças distintas).
   Quando Google e Geoapify identificam o mesmo negócio, prevalece o registro
   completo Google.
7. A busca seguinte retoma o provedor correto por token de paginação, sem
   repetir a primeira página Geoapify ao carregar mais.
8. Cada cartão e modal identifica a origem **Geoapify · © OpenStreetMap
   contributors** ou **Google Maps**, com fonte identificada também nas
   notas e na atividade do lead cadastrado.

## Cobertura dos 196 nichos

O arquivo `supabase/functions/_shared/geoapify-niche-categories.ts`
faz uma decisão explícita para **cada um dos 196 nichos**.
- 69 nichos possuem categorias Geoapify adequadas, por exemplo Academia,
  Chaveiro, Barbearia, Clínica Médica e Restaurante.
- Os demais 127 partem diretamente para Google Places, sem retornar
  empresas de categorias amplas potencialmente erradas.
- O mapa de correspondência não é uma garantia de cobertura geográfica:
  a presença de dados e telefones na base Geoapify depende de
  OpenStreetMap e varia por município.

## Custos, segurança e limites

- `GEOAPIFY_API_KEY` deve estar salva como **segredo de Edge Function**
  no projeto Supabase original, nunca no JavaScript do navegador.
- Quando a chave estiver ausente a pesquisa **continua com Google Places**,
  de forma compatível com o sistema que já funciona. A presença da chave
  no ambiente não é verificável pelo conector atual; precisa ser confirmada
  pelo painel ou por teste autenticado dos resultados.
- A primeira consulta Geoapify usa geocodificação de cidade (com cache
  de 6h no processo) e uma consulta Places; ambas podem consumir cotas/
  créditos de uso **do provedor Geoapify**. Isso é diferente de créditos
  de usuários: não foi criado **nenhum saldo, sistema de pontos, cobrança
  por usuário ou limite novo** para o Januário Leads.
- A proteção preexistente `claim_api_request_for_user`, de uso
  temporário da API, não foi alterada. Ela não constitui pontos de plano.
- Reduz a máscara de campos do **Google Text Search** removendo
  `places.editorialSummary` da busca inicial (pode elevar o SKU para
  Enterprise + Atmosphere), mantendo esse campo disponível na consulta
  detalhada. Telefones, horários, avaliações e site continuam na máscara
  de busca existente e podem gerar custo Google quando a API é usada.
- Consulta sempre no backend autenticado, com timeouts de até 6,5s de
  geocodificação e 8s de Places, sem expor chaves ou URLs com segredos.
- Não consulta servidores comunitários de Overpass.

## Testes
- `supabase/functions/_shared/geoapify-search.test.ts` valida as 196
  opções, casos com/sem telefones, sem chave, cidade/UF exatas, separação
  de fonte e filtro por município, simulando respostas HTTP.
- Testes foram adicionados no diretório `supabase/functions/_shared/`
  que já integra o script `npm test`.
- Revisão estática e verificação de deploy devem ser concluídas antes
  de considerar o ambiente homologado.
- Não há token de usuário de teste disponível ao conector atual para
  validar de ponta a ponta uma consulta real.

## Homologação manual
1. Verificar se o segredo `GEOAPIFY_API_KEY` existe no projeto Supabase
   original. Se não, configurá-lo **somente no painel de segredos**.
2. Buscar "Academia" / "Lavras" / "MG", conferir a fonte mostrada por
   empresa. Comparar uma cidade maior e uma cidade pequena.
3. Buscar um nicho direto Google, como "Consultoria de RH".
4. Confirmar que um resultado Geoapify pode ser salvo sem erro, reaparece
   em Meus Leads e permite enriquecimento por busca de nome/telefone.
5. Confirmar cenário de Google temporariamente indisponível: Geoapify
   existente retorna resultados parciais com aviso; quando ambos falham
   o usuário recebe um erro claro.
6. Testar paginação e ausência de duplicatas, ambos provedores e
   atribuição no modal.
7. Verificar custos/limites reais de ambos os fornecedores e a legislação/
   termos de utilização antes de abrir a plataforma ao público.

Esta implementação não inclui mapa interativo, Google Maps no OpenStreetMap,
tabela nova, sistema de pontos ou cobrança própria.
