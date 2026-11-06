# Reformulação da homepage — referência de HTML RastroLead (06/11/2026)

## Origem e limites do material fornecido

A referência recebida foi um arquivo de texto Markdown contendo uma captura de HTML com estilos convertidos em classes \`style-0\`, \`style-1\`, etc. A análise foi feita sem copiar componentes, textos promocionais, imagens, CSS ou vídeo do concorrente.

**Evidência relevante sobre mídia:** o HTML contém **um** elemento \`<video>\` com \`controls\`, \`playsinline\`, \`preload="metadata"\`, apontando para um MP4 e um JPG externos ao arquivo. O HTML enviado **não inclui os bytes desse vídeo**. Outros efeitos visuais da referência vêm de CSS/transições em elementos da tela; no arquivo convertido aparecem declarações de \`animation\`, mas não o código de todas as animações e suas transições.

Portanto, **não usamos o vídeo nem qualquer screenshot ou arquivo do RastroLead**. A nova solução é uma demonstração interativa e animada **original** do Januário Leads, feita com React e CSS, com empresas fictícias.

## O que inspirou a experiência (não a identidade)

1. **Primeiro impacto:** promessa objetiva do produto e painel representativo. Mantida identidade preta, grafite e vermelha do Januário Leads; agora com movimentos sutis no mock do dashboard.
2. **Produto em movimento:** seção \`#tour\` com player ilustrativo original de 4 etapas: **Buscar Leads → Selecionar → CRM → Follow-up**. Reprodução automática iniciada no carregamento da página, pausa/reinício, escolha manual e controles de etapa. Pausa quando a aba não está visível. Nenhuma chamada de Supabase ou Google Maps.
3. **Pesquisa interativa:** seção \`#demonstracao\` mantém a troca de segmento/cidade usando dados falsos, de modo que o visitante possa experimentar o conceito sem login.
4. **Comunicação contextual:** exemplo original de modelo de mensagem com três canais, cópia para área de transferência e indicação de **envio manual**. Não promete geração por IA nem envio automático no site público.
5. **Organização comercial:** preservados cards de dificuldades, fluxo de trabalho, funcionalidades reais, perfis de profissionais, comparação manual versus CRM, acesso por convite, FAQ e CTA final.
6. **Usabilidade:** barra informativa realista, menu mobile operável, cabeçalho fixo com estilo isolado; animações respeitam \`prefers-reduced-motion\`, pausam quando a aba está oculta, e ficam disponíveis com controles manuais.

## O que não replicamos

| Elemento da referência | Decisão no Januário Leads |
|---|---|
| MP4, poster, screenshots, logotipo, estilos e código do concorrente | Não utilizados nem incluídos |
| Preços, desconto Black Friday, limites de varreduras e avaliação de usuários | Não replicados — ainda não há planos ou evidências públicas equivalentes |
| Disparo automático de WhatsApp, cadências automáticas e campanhas | Não prometidos — os contatos continuam sob controle do usuário |
| Radar proprietário de pontuação do concorrente | Não copiado — demonstramos apenas etapas e acompanhamento que o CRM possui |
| Webhooks e integrações n8n/Make/Sheets | Não anunciados como disponíveis no Januário Leads |
| Contadores de resultados e empresas reais da referência | Substituídos por dados de demonstração explicitamente fictícios |

## O que a PR modifica

- \`src/components/marketing/AnimatedProductTour.tsx\` + CSS: player com cenas de busca, seleção, CRM e follow-up; auto avanço **4,9 s por cena** quando visível, controles e pausas.
- \`src/components/marketing/MessageExampleDemo.tsx\` + CSS: modelos de contato alternáveis, cópia local, nenhuma rede.
- \`src/components/marketing/MarketingHome.tsx\`: novo posicionamento da demonstração, CTA, barra informativa, navegação mobile acessível, seções e títulos revisados.
- \`src/routes/__root.tsx\`: carrega CSS específico das novas demonstrações.
- \`tests/browser/animated-product-tour.spec.ts\` e \`tests/browser/message-example.spec.ts\`: testes browser de interatividade, acessibilidade básica, movimento reduzido, responsividade e rede bloqueada.

## Critérios de qualidade

- Autoanimação inicia no cliente sem depender do IntersectionObserver ou da posição de rolagem; pausa quando a aba não está visível e não depende de arquivo do concorrente.
- Usuário pode pausar, reiniciar, escolher qualquer etapa e usar \`#tour\` diretamente.
- Se o navegador configurar movimento reduzido, não há autoanimação, e as etapas continuam acessíveis por botões.
- Homepage pública e demos não consultam leads, não criam contas, não chamam API pagas e não disparam mensagens.
- Responsividade nos tamanhos 360, 390, 768 e 1280 px; menu de celular operável.
- Não altera \`/app\` (CRM), \`/login\`, \`/cadastro\`, Supabase, migrações nem permissões.

## Vídeo real do Januário Leads (etapa futura)

As animações atuais são **demonstrações visuais**, não uma gravação do sistema real. Se for necessário mostrar operação comprovada, o próximo avanço editorial é **gravar um MP4 original do Januário Leads** com uma conta de teste e empresas fictícias, revisar para evitar exposição de informações e então hospedar poster + arquivo com \`<video controls playsInline preload="metadata">\`. Nenhum material do concorrente deve ser usado.
