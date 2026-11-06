# Reformulação comercial e autenticação — 06/11/2026

## Motivo

Revisão pedida pelo proprietário do Januário Leads após testar as animações: reduzir CTAs repetidos, eliminar referências promocionais a Lavras/MG, melhorar a variedade visual das seções, profissionalizar mensagens e ter um login/cadastro próprios.

**Implementação limitada à interface pública. Não modifica Supabase Auth, policies, migrations, Edge Functions, private_access, APIs ou dados da produção.**

## Mudanças de UX

- Header: botão **Criar conta** abre \`/cadastro\`; **Entrar** continua em \`/login\`.
- Hero: removidos os dois CTAs **Explorar o Januário Leads** e **Já tenho acesso**, mantendo título, diferenciais e animação Buscar Leads.
- Buscar Leads no hero: removido **Acessar o sistema** do rodapé animado. Os links existentes fora do hero continuam.
- Localização das demos: **Curitiba/PR** substitui Lavras/MG em restaurantes e em todas as cenas do tour. Clínicas continuam em Belo Horizonte/MG; academias em Campinas/SP. O padrão do produto autenticado e das buscas reais **não foi alterado**.
- Modelos de mensagem: comunicação pronta para personalizar, com cópia e indicação de **envio manual**. Removidas etiquetas repetitivas de teste/fictício nesse componente; continuam sem realizar envios.
- Seção de desafios: agora é editorial, com problemas e respostas lado a lado (em vez de três cards iguais).
- Processo comercial: linha de etapas compacta, sem cards empilhados.
- Ferramentas: explorador de **seis módulos** com seleção e detalhes contextualizados.
- Públicos: seletor de **três perfis profissionais** com casos de uso, em vez de outro grid de cards.
- Seções de comparação, tour e abordagem preservadas com identidades próprias.
- Animações escolhidas do ZIP CodeMakers: **03 Surgir com Leveza** (mudança dos painéis), **04 Entre em Movimento** (entrada curta), **05 Entrada em Sequência** (itens editoriais com atraso limitado) e **09 Interação que Responde** (hover/foco nos seletores). Implementadas em CSS sem dependência adicional; \`prefers-reduced-motion\` respeitado.

## Login e cadastro — funcionamento real

O novo \`AuthShell.tsx\` forma um par de páginas próprias, mobile-first, com identidade Januário Leads. O login em \`/login\` **continua realizando autenticação existente**, validando \`private_access\` e redirecionando contas autorizadas para \`/app\`; o fluxo HTTP-only BFF, quando habilitado no ambiente, não foi modificado.

\`/cadastro\` agora tem linguagem e visual profissional para criação de conta. O **formulário funcional de e-mail e senha continua exclusivamente em ambiente Supabase staging**, sob \`VITE_BETA_SIGNUP_ENABLED=true\` + project ref e chave publishable de um projeto explicitamente diferente da produção, como anteriormente definido em \`docs/cadastro-beta-staging-2026-11-06.md\`.

**Em produção, o cadastro permanece fechado por padrão.** O botão Criar conta leva à página informativa; não apresenta um formulário que falha silenciosamente. Não se criam identidades em produção ou acesso ao CRM sem homologação, configuração de confirmação de e-mail, controle de abuso, ativação de usuários e restauração/segurança comprovada.

## Demonstrações versus dados reais

Os dados da busca e do tour são **simulados**, não clientes ou pesquisas em tempo real. A interface continua identificando claramente a demonstração nesses locais. Remover essa informação de todas as áreas poderia passar uma impressão enganosa ao visitante.

## Arquivos e validação

- \`src/components/marketing/MarketingHome.tsx\`: simplificação de CTAs, nova composição e textos.
- \`src/components/marketing/MarketingModules.tsx\`, \`src/styles/marketing-editorial.css\`: 4 formatos diferentes de seção.
- \`src/components/auth/AuthShell.tsx\`, \`src/styles/auth-identity.css\`: identidade compartilhada para login e cadastro.
- \`src/routes/login.tsx\`, \`src/routes/cadastro.tsx\`: interface pública de autenticação.
- \`src/components/marketing/MessageExampleDemo.tsx\`, \`AnimatedProductTour.tsx\`: textos e locais.
- \`src/routes/__root.tsx\`: CSS carregado.
- \`tests/browser/saas-home-auth-refresh.spec.ts\`: CTAs, variação, seletores, cadastro e responsividade.
- Testes anteriores atualizados para textos novos.
- Rodar GitHub CI e regressões. Publicar no Lovable é etapa separada de merge no GitHub.

## Próxima etapa para cadastro aberto

Criar/homologar ambiente adequado, testar fluxo de confirmação e recuperação, ativação separada, limites de uso no servidor e regras de isolamento de dados, confirmar backup restaurável e reconciliar migrations **antes** de liberar contas comerciais ou pagamento.
