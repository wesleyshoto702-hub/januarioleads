# Buscar Leads + Abertos Agora — prévia visual sem pontos

Implementação inicial da navegação unificada, 05/11/2026.

## Como funciona

- A barra lateral do Workspace mostra somente **Buscar Leads**.
- Dentro de `SearchLeadsView`, o usuário alterna entre os modos
  **Todas as empresas** e **Abertos Agora**; o item **Buscar Leads**
  permanece ativo no menu nos dois modos.
- Nos dois modos a pesquisa é por **UF, cidade e um segmento**.
- A busca de empresas utiliza a função `search-places` **já existente**;
  nenhuma solicitação extra é feita somente para alternar o modo.
- **Todas as empresas** mostra os registros da pesquisa, inclusive
  o selo de aberto/fechado quando essa informação foi retornada.
- **Abertos Agora** filtra os registros já carregados por
  `business.isOpenNow === true`. Fechados e status desconhecido ficam
  ocultos. O resultado não é um inventário completo de empresas abertas.
- No resultado, o seletor alterna entre os modos **sem limpar os resultados,
  fazer nova consulta ou consumir créditos**.
- `Carregar mais` continua sendo uma ação separada, e pode consultar o
  Google se houver próxima página e o usuário clicar.
- Abertos Agora não usa mais a antiga interface de
  `OpenNowNichesView`, que permitia atualizar vários nichos em sequência.
  O código legado não foi excluído nesta prévia; o endpoint
  `open-now-niches` não foi desativado nem removido do projeto.

## O que não mudou

- Nenhum sistema de pontos, carteira, crédito, débito ou preço foi criado.
- Nenhuma consulta real ao Google foi iniciada pela implementação.
- Os dados já salvos em Meus Leads não foram alterados.
- O agendamento de atualização automática de Places, desativado
  anteriormente, permanece fora do fluxo.
- As limitações de cotas, custos e termos de armazenamento/uso de conteúdo
  do Google Places continuam requerendo revisão antes do lançamento pago.

## Verificação

- Testes que confirmam um único item Buscar Leads no menu e alternância dos dois modos internamente.
- Teste de resultados abertos, fechados e sem informação, garantindo
  que a mudança de modo **não gera uma segunda requisição à API**.
- Testes já existentes de pesquisa, CRM, tipos, build e responsividade.
