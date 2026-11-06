# Januário Leads — Buscar Leads animado no hero (06/11/2026)

## Objetivo

Mover a **animação existente** de Buscar Leads da seção inferior para a primeira dobra da homepage, **à direita de "Boas oportunidades começam com contatos certos"**, substituindo a prévia estática "Januário Leads / Visão geral". Economizar espaço sem perder os detalhes interativos. **Preservar a animação "Como funciona o Januário Leads? Veja na prática" logo abaixo do hero.**

## Referência recebida

O arquivo entregue foi \`rastro-lead-replica(1).html\`, uma réplica HTML autônoma do Rastro Lead criada pelo usuário. Inspecionamos sua estrutura e seu comportamento JavaScript:
- hero em duas colunas, digitação de nichos, painel ilustrativo, partículas/radar e cartões flutuantes;
- demonstração sequencial de pesquisar, priorizar e organizar, com transição entre cenas;
- CSS responsivo e modo de movimento reduzido;
- variável JavaScript \`VIDEO_SRC = ""\`: vídeo **não configurado** no HTML recebido; as cenas são geradas pela interface, não por MP4 embutido.

Usamos **princípios de layout e movimento**, não código, imagem, marca, paleta verde, nomes de empresas reais ou alegações comerciais da referência.

## Mudanças no Januário Leads

- \`src/components/marketing/MarketingHome.tsx\`: renderiza **a mesma** \`SearchDemo\` animada já existente **uma única vez**, em \`id="demonstracao"\` ao lado do texto do hero. Remove \`ProductMock\` estático, remove a seção inferior redundante e elimina o CTA intermediário que apontava para a pesquisa "abaixo". O tour com \`<AnimatedProductTour />\` continua exatamente no lugar abaixo do hero.
- \`src/styles/hero-search.css\`: adapta o painel existente a uma coluna mais estreita com um radar decorativo vermelho/grafite, moldura e cartões informativos; CSS isolado na área do hero, sem alterações no CRM.
- \`src/routes/__root.tsx\`: carrega a folha de estilos adicional.
- Navegação de desktop e celular: \`#demonstracao\` continua válido e leva à animação agora no topo.
- Testes verificam que existe **exatamente um painel Buscar Leads**, sua posição à direita em desktop, empilhamento em celular, ausência de barra de rolagem horizontal, preservação do tour e ausência de chamadas Supabase.

## Verdade funcional / privacidade

O simulador alterna segmentos e cidades com **empresas de exemplo fictícias**, anima digitação, busca, resultados e destaque de contato. **Não** chama Google Places nem Supabase, **não** cria ou envia leads, **não** dispara mensagens, não cobra ou permite cadastro comercial. O CRM privado, autenticação, RLS e configurações do Supabase não foram alterados.

## Publicação

O merge no GitHub integra o código ao repositório. Se o site publicado no Lovable não mostrar o hero novo, é necessário confirmar a sincronização/atualização e publicar as mudanças na hospedagem; o merge por si só não garante o deploy externo.
