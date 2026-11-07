# Aurora carmesim — substituição do efeito antigo

## Origem e escopo

Substituída a aurora de filamentos implementada anteriormente por uma versão adaptada do arquivo HTML **crimson_aurora_saas_background.html** fornecido pelo responsável do Januário Leads (07/11/2026).

Apenas o **motor visual de fundo** foi adaptado: quatro ondas senoidais com gradientes carmesim/rubi, brilho radial ambiente, partículas e interação suave com o mouse. O cabeçalho, hero, textos, cards, formulários, CTAs e fluxos existentes do SaaS **não** foram substituídos pelos elementos fictícios do HTML de demonstração.

A substituição é aplicada nas telas que reutilizam \`AuroraBackdrop\`: homepage, produto, login e cadastro restrito. Não há nenhuma instalação do Tailwind via CDN, de fonte externa adicional ou de dependência de animação.

## Motivo da troca

A aurora anterior desenhava cinco cortinas compostas por muitos segmentos/raios e gradientes individuais e, além disso, animava quatro elementos CSS com \`filter: blur\`. O conjunto contribuía para atrasos de quadros e interações observados em testes de laboratório.

A nova implementação gera apenas **quatro caminhos fechados** por quadro (36 segmentos em desktop, 24 no mobile) e um campo pequeno de partículas. As partículas têm halos sólidos, sem \`shadowBlur\` por partícula; não existem mais os quatro elementos \`.jl-aurora-wisp\` ou os filtros CSS animados.

## Segurança de desempenho

- Os quadros são limitados em condições normais a aproximadamente **22 por segundo no desktop e 15 no mobile**, com cadência adaptativa (até 9 FPS caso o desenho pese). **Não há promessa de 60 FPS.**
- O buffer do Canvas é limitado a cerca de **900 mil pixels no desktop e 600 mil no mobile**, em vez de usar DPI máximo do dispositivo indiscriminadamente.
- A animação pausa em abas ocultas e respeita \`prefers-reduced-motion: reduce\` (quadro estático).
- A animação **não pausa** durante scroll, roda do mouse, toque, clique nem digitação. Os limites de resolução e quadros adaptativos permanecem ativos.
- Nenhum \`setState\` React é chamado a cada quadro; eventos e \`requestAnimationFrame\` são removidos no desmontar do componente.
- O Canvas recebe \`pointer-events: none\` e continua abaixo dos elementos clicáveis do site.

**Limitação:** isso reduz custo computacional, mas não garante ausência absoluta de travamentos em todos os aparelhos. O desempenho percebido deve ser conferido em aparelhos reais, inclusive quando o site for republicado.

## Testes de aceitação

- TypeScript e build de produção.
- Chromium/Playwright: novas ondas carmesim, movimento temporal, interatividade, proteção de clique, suporte a movimento reduzido, ausência das camadas antigas e teto de pixels no mobile/desktop.
- Responsividade Firefox/WebKit quando disponível no CI.
- Validação externa (LCP, INP e CLS de visitantes) não disponível enquanto o site Vercel permanecer despublicado.

**Status de publicação:** nenhuma alteração no estado da Vercel; integração GitHub não equivale a deploy de produção.
