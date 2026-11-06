# Atmosfera animada contínua — Januário Leads (06/11/2026)

## Objetivo

Estender o movimento suave e as "bolinhas" vermelhas/rosadas do destaque do hero para **todo o site público** (homepage, /produto, /login e /cadastro), sem tornar a página cansativa ou interferir no produto.

## Implementação

- \`src/components/marketing/AmbientParticles.tsx\`: componente decorativo único e reutilizado, com **20 partículas estáticas no React** e 4 elementos de ambiente (2 halos e 2 anéis de radar). Coordenadas e velocidades são determinísticas, evitando diferença de renderização no servidor. Nenhum timer, canvas, mouse tracking, Math.random, pacote externo, recurso de rede ou cobrança.
- \`src/styles/ambient-particles.css\`: animações CSS de deriva lenta (25–47 s para partículas; 30–40 s para halos e anéis), em vermelho/coral/magenta, opacidade baixa. \`position: fixed\` mantém o fundo visível enquanto o usuário percorre a homepage.
- O fundo tem \`aria-hidden="true"\`, \`pointer-events: none\`, sem tabIndex, para nunca capturar foco, cliques ou rolagem.
- Mobile: menos partículas renderizadas visualmente via media query; menos brilho e prioridade de desempenho.
- Com \`prefers-reduced-motion: reduce\`, todas as animações ambientais param, mantendo no máximo um acabamento estático discreto.
- O componente aparece em \`MarketingHome.tsx\` e \`AuthShell.tsx\`; a tela de login/cadastro recebe menor intensidade. O **CRM interno (/app) não recebe partículas**, para preservar leitura, tabelas e formulários.
- O tour de quatro etapas, a animação Buscar Leads e os componentes da homepage não foram reescritos.

## Validação

\`tests/browser/ambient-particles.spec.ts\` verifica:
1. Presença e quantidade de partículas em /, /produto, /login e /cadastro.
2. Efeito fixo durante rolagem; nenhum acesso à API Supabase da produção.
3. Acessibilidade decorativa, \`pointer-events:none\`, respeito a movimento reduzido.
4. Ausência de overflow horizontal e navegação clicável no celular e desktop.

## Entrega e publicação

A PR deve passar por TypeScript/build, testes browser e responsividade antes de merge. **Merge não significa publicação no Lovable**; a atualização do site público pode exigir Publish → Publish changes.
