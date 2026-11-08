# Busca inteligente de um clique — Geoapify + Google Places (staging)

Implementado em 08/11/2026 sobre a PR #92. O cliente **não escolhe provedores**.
Um envio do formulário realiza a busca e devolve os resultados automaticamente.

## Roteamento
- Staging + nicho suportado + sem bairro: tenta Geoapify com JWT, gate Maps do plano,
  orçamento da API e limite de 20; se houver empresas, termina.
- Geoapify sem empresas **ou indisponível por limite da fonte**: continua, no mesmo
  clique e de forma sequencial, com **uma busca real Google Places** via `search-places`.
  Google não recebe `stagingDemo` e mantém seus próprios guardrails de custos.
- Bairro informado ou nicho não suportado no Geoapify: vai diretamente ao Google,
  evitando consumir créditos Geoapify sem chance de correspondência.
- Recusas de autenticação, de plano, de requisição inválida e de rate limit compartilhado
  **NÃO** autorizam contornar a recusa por outro provedor.
- Nunca chama as duas fontes em paralelo; não mistura registros nem converte
  identificadores OSM para Place IDs Google.
- A interface não exibe nomes de provedores como ações; mostra atribuição
  Geoapify/OSM ou Google Maps junto à lista, conforme necessário para licenciamento.
- **Sem contatos importados nem escrita CRM** em staging durante homologação.
  A prévia segue com mapa ilustrativo sem marcadores artificiais.

## Limites e custos
- Uma ação pode causar até 1 geocodificação Geoapify + 2 buscas Geoapify
  (cidade e raio de fallback de 10 km) + 1 busca Google, somente se necessário.
- Cada chamada reserva cota da respectiva API no backend, com bloqueios por
  usuário e projeto. Não significa que apenas uma API é cobrada por busca.
- Maps continua visível somente a Pro e Advanced. Produção permanece inalterada.
- A UI não garante empresa se nenhum provedor possuir cobertura, credencial
  válida ou orçamento disponível. Mensagens informam indisponibilidade
  sem forjar resultados nem exibir dados de outro negócio.
- O Google Places segue sujeito às regras de cache, atribuição e
  armazenamento: https://developers.google.com/maps/documentation/places/web-service/policies

## QA
- `tests/browser/maps-leads-pro-advanced.spec.ts`: uma ação faz até duas consultas
  sequenciais; geo com resultados interrompe; limite geo roteia ao Google;
  permissão não é burlada; bairro consulta Google direto; chave Google
  indisponível não simula dados; Free não vê recurso Maps.
- Prévia Vercel deve ser reconstruída com env vars apontando **apenas** para
  `prlrxjothrslhswpkoza` antes de qualquer teste por navegador.
- PR de homologação: não mesclar na main antes de E2E autenticado, revisão
  de licenças e medidas de custo no dashboard Google/Geoapify.
