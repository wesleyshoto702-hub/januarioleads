# Januário Leads — Auditoria operacional do Buscar Leads, custos e CRM (15/11/2026)

Escopo: **GitHub + Supabase de HOMOLOGAÇÃO**, sem modificar a Colab, o banco de produção ou o deploy do site de produção. O frontend pode estar desatualizado até ser publicado; os testes abaixo não usam APIs externas reais.

## 1. Buscar Leads e dados Overture

- Catálogo canônico de **216 nichos** em 16 grupos, incluindo os 20 adicionados nesta data.
- Consultadas as categorias *exatas* em `overture_places` da HOMOLOGAÇÃO. **125 nichos** possuem mapeamento de categorias Overture. **116** deles possuem registros com algum contato informado na base nacional atual; os outros **9 mapeados** não mostraram contatos: Chaveiro, Lavanderia, Serralheria, Construtora, Locadora de Veículos, Berçário / Creche, Agência de Viagens, Fotógrafo e Loja Agropecuária. Há **91 nichos sem mapeamento específico** no Overture; esses retornam zero na camada Overture, podendo usar apenas o fallback autorizado de Geoapify/Google, se configurado e orçado.
- Os números são **agregados do Brasil inteiro** e **não** comprovam cobertura por município nem contato oficialmente verificado. Os 116 são números de nichos, não de empresas.
- Top 5 categorias de nichos com registros de contato nos dados atuais, contagens aproximadas: Loja de Roupas 11.321; Restaurante 11.177; Mercado / Supermercado 9.434; Hotel 9.201; Salão de Beleza 8.390. As categorias podem se sobrepor e as contagens mudam conforme a Colab importar mais dados.
- A busca usa `state`, `city_key`, `category` exatas no PostgREST e recusa classificações amplas para nichos específicos.
- Filtros locais **Sem site, Com telefone, Com Instagram** já existiam; foi adicionado **Com e-mail** e o e-mail público aparece como **não verificado** no cartão. Os filtros em dados carregados não acionam novas chamadas pagas.
- Sites ausentes/Instagram candidatos representam informação **não identificada nesta fonte**, não ausência comprovada. Instagram informado por diretórios exige validação, com detalhes em modal.
- Atenção operacional: `searchOverture` consulta no máximo **100 entradas por cidade/categoria combinada** antes de ordenar/paginar; portanto não equivale a busca exaustiva em municípios grandes. Melhorias futuras devem preservar controle de leituras e limites do banco.

## 2. Proteção contra custos

- `external-provider-approval.ts`: limites de consultas externas são **zero por padrão** sem variável configurada com número positivo.
- Google Places exige adicionalmente `GOOGLE_PLACES_SPEND_APPROVED=true`. Mesmo habilitado, **cada consulta** deve passar pelo RPC de orçamento atômico com operação/SKU, projeto/mês/dia/usuário. A presença da chave sozinha não autoriza gastos.
- Geoapify exige `GEOAPIFY_SEARCH_DAILY_CAP` positivo e reserva atômica separada para geocode e places; a função compartilhada nega rede sem callback de reserva.
- `open-now-niches`: proteção Google Enterprise acrescentada também aos refreshes/paginação. `sync-leads`: desativado por padrão, exigindo `GOOGLE_PLACES_SYNC_ENABLED=true`, autorização de gasto e orçamento por tentativa (incluindo retries).
- `deep-enrich-business`: processamento determinístico continua possível, mas chamadas pagas OpenAI exigem `OPENAI_ENRICHMENT_SPEND_APPROVED=true`.
- Limites **atuais lidos** do Supabase HOMOLOGAÇÃO antes da alteração (não alterados nesta execução): Geoapify geocode e places: 50/dia de projeto, 1.000/mês, 5/dia/usuário cada; Google text_search_enterprise: 15/dia, 800/mês, 5/dia/usuário; Google place_details_enterprise: 15/dia, 600/mês, 5/dia/usuário. A configuração no banco que diz `enabled=true` **não substitui** o opt-in da Edge Function.
- A Edge Function `search-places` de **HOMOLOGAÇÃO** foi implantada na versão **29**, `ACTIVE`, JWT obrigatório. Os novos guardas dos outros endpoints estão no GitHub, mas **não foram implantados neles** nesta execução. Produção permanece sem alterações. Testes offline não são testes de credenciais de provedores.
- Mesmo com limites no código, definir também alertas e orçamento no painel do Google Cloud continua recomendado como defesa adicional.


- **Conferência de deploy auxiliar:** ao consultar a homologação, `open-now-niches`, `sync-leads` e `deep-enrich-business` não estavam publicados. Assim, as proteções adicionadas a esses endpoints permanecem no GitHub para o caso de implantação futura, sem garantir proteção em outros ambientes fora da homologação.

## 3. Qualificação comercial

- `qualifyDigitalOpportunity`: sinais descritivos **Potencial para site**, **Contato a investigar**, **Canais a revisar**, **Presença digital identificada**.
- Disponível no código de resultados do Buscar Leads, detalhes da empresa, cartões Meus Leads desktop/mobile, Kanban **e cartões de Oportunidades**. Nenhuma pontuação arbitrária de "chance de fechar negócio", nem WhatsApp declarado como verificado por causa de um telefone. Um Instagram apenas informado, mas sem confiança alta, também **não é considerado confirmado**.
- A qualificação é local em memória, sem gravação de atributos novos em Supabase nem consulta externa.

## 4. Responsividade e CRM

- Verificações existentes em `tests/browser/responsive.spec.ts` incluem resoluções **320 a 1920 px**, navegação por Dashboard, Meus Leads, Buscar Leads, Oportunidades, Mensagens e Financeiro, modais, menu mobile e áreas interativas.
- Casos de teste adicionais usam **empresas e usuários fictícios**, simulando o backend: filtros de site/e-mail, seleção de novo nicho, rótulos de qualificação, detalhes e favoritos no celular, sem Google Places nem WhatsApp real.
- Testes funcionais de Kanban, follow-up, notificações e carregamento do CRM também existem em `tests/browser/prospecting-workflow.spec.ts`, mas não devem ser considerados aprovados sem executar.
- O workflow `validar-prospeccao-responsiva-4-etapas.yml` executa um subconjunto Chromium offline no CI, com TypeScript e build. A rodada do commit `a9c6645c7854` passou: **4 testes Chromium simulados + TypeScript + build**, sem APIs externas reais: https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43726916310. Rodadas posteriores devem ser conferidas separadamente. O workflow geral `Validar catálogo de nichos` **segue falhando** por baseline de migrations e testes de navegador de outras funcionalidades (47 falhas e 78 sucessos na rodada `43727014413`). Isso impede afirmar que a suíte completa está aprovada. Não modificar produção nem executar migrations corretivas durante a Colab para resolver esses testes.

## Etapas de publicação

O código frontend foi enviado ao GitHub, mas **nenhuma publicação do frontend foi efetuada**. As alterações da Edge Function de busca estão apenas na homologação. Validar primeiro UI e permissões em staging; produção não deve ser alterada sem aprovação e estratégia de rollback.
