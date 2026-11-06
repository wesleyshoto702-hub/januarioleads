# Homepage minimalista com aurora — 06/11/2026

## Alterações de apresentação

- Remove a faixa de benefícios acima do hero (`jl-marketing-briefing`).
- Mantém apenas três diferenciais próximos ao título, lado a lado no desktop: **Busca por cidade e nicho**, **CRM e próximos contatos**, **Acesso pelo navegador**.
- Remove o aviso promocional sobre "evolução comercial" e acesso por convite do hero.
- Simplifica a prévia Buscar Leads sem rodapé técnico e sem legendas duplicadas, preservando a animação interativa e a sinalização de dados de demonstração.
- Remove os dois grandes painéis de conversão próximos ao rodapé: "A próxima fase da sua prospecção começa por aqui" e "Transforme sua pesquisa em um processo comercial".
- O FAQ fecha o conteúdo antes do rodapé; remove a pergunta sobre assinatura ainda não lançada, mantendo as perguntas sobre funcionalidades reais. O ícone `+` passa a ser SVG centralizado no quadrado.
- Remove setas decorativas de botões e links públicos da navegação/cadastro, bem como numerações desnecessárias na seção de dificuldades.

## Processo comercial animado

A trilha **Explore → Organize → Acompanhe** acende em vermelho sequencialmente quando a seção entra na área visível do navegador. Cada etapa concluída permanece vermelha; a linha de progresso se preenche até a terceira etapa. O efeito é acionado uma vez por carregamento da página, sem loop chamativo.

Com `prefers-reduced-motion`, todas as etapas já aparecem concluídas sem movimento. A sequência usa `IntersectionObserver` e dois `setTimeout` curtos, com limpeza no desmontar do componente e fallback para navegadores sem suporte.

## Nova aurora, de fato atrás do conteúdo

- Remove o componente anterior com **20 partículas**, a folha CSS correspondente e os testes antigos.
- Adiciona `AuroraBackdrop` com quatro cortinas de luz (rosa/vermelho, violeta, ameixa e azul discreto) e um véu ambiental, apenas CSS.
- A aurora fica no **z-index 0**; cabeçalho, conteúdo e rodapé estão em camadas superiores. Os fundos das seções são semitransparentes, permitindo ver a luz no fundo **sem sobrepor o texto**.
- Sem canvas, imagens, rede, dependências, eventos de mouse ou cronômetros para o fundo. As animações são lentas e contínuas; no celular são reduzidas e com movimento reduzido ficam estáticas.
- Aplica-se às páginas públicas `/`, `/produto`, `/login` e `/cadastro`. Não se aplica ao CRM privado.

## Limite comercial importante

A apresentação da homepage não usa linguagem de beta/convite. **Isso não significa que o cadastro público, as assinaturas ou as liberações de acesso tenham sido implementados.** A página `/cadastro` continua informando quando a criação de novos usuários está indisponível, sem abrir um cadastro inseguro no Supabase de produção. Nenhuma migração, policy, variável de Auth, plano ou pagamento foi alterado.

## Verificações

- Testes browser de: camadas da aurora, navegação sem bloqueio de cliques, ausência de rolagem horizontal, responsividade, movimento reduzido, transição vermelha do processo e FAQ centralizado.
- Testes existentes de navegação e FAQ atualizados para a interface reduzida.
- Publicação no Lovable é separada do merge no GitHub.
