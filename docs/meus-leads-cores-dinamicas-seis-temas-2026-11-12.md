# Meus Leads — cores dinâmicas conforme o tema

Data: 12/11/2026

## Problema identificado

A tela **Meus Leads** continuava verde mesmo quando a conta selecionava azul
em Configurações. A causa era o arquivo
`src/features/leads/lead-portfolio-overview.css`: seus cards de status,
Acompanhamento e Financeiro, bordas, fundos, cartões e símbolos de nicho
usavam cores verdes literais que ignoravam a configuração global.

## Solução

- Substituídas **109 cores hexadecimais fixas** por variáveis semânticas
  ou por `color-mix()` calculado com a cor ativa.
- A tela agora herda **`var(--primary)`, `var(--surface)`,
  `var(--surface-2)`, `var(--border)`, `var(--text)`,
  `var(--muted)`** e os tokens para status.
- O valor de `--primary` já é controlado em `src/styles.css` pelo
  atributo `data-jl-accent` de `document.documentElement`, atualizado
  pelo hook de `src/routes/app.tsx`. O usuário **não precisa atualizar
  a página** nem recarregar leads quando troca de cor.
- Cores herdadas: **verde, amarelo, azul, vermelho, branco e grafite**
  (identificador interno `black`).
- No tema azul o destaque vem do token **`#60a5fa`** já existente.
  Não foi criada outra paleta de azul nem adicionados valores hardcoded
  específicos para esse tema.
- Ajustados seletores antigos mais específicos em
  `premium-reference-five-pages.css` somente **por overrides
  encapsulados em Meus Leads**, sem mudar os demais módulos:
  fundo do cabeçalho, inputs, botões e símbolos vetoriais.
- Mantidos por significado: **favorito dourado**, estado
  **Aguardando** em âmbar, **Recusado** e exclusão em vermelho.
  O estado Aceito e os demais destaques de interface acompanham a cor
  ativa como solicitado.

## Escopo seguro

A correção altera apenas o CSS de Meus Leads e esta documentação.
Não altera dados, projetos Supabase, permissões, busca, leads,
favoritos, mensagens, Kanban, financeiro ou qualquer outro tema do site.

## Verificação estática

- Confirmadas as seis entradas em `:root.dark[data-jl-accent]`.
- Confirmado o efeito React que define `data-jl-accent` na raiz.
- Verificada a importação do CSS por último em `APP_STYLES`.
- Sem variáveis internas faltantes ou desequilíbrio entre chaves e parênteses.
- Resta apenas um hexadecimal literal no CSS: o **dourado do favorito**.
  Nenhum verde RGB ou hexadecimal permanece no arquivo.
- Compilação e inspeção visual autenticada no navegador ainda devem ser
  executadas no ambiente apropriado antes de afirmar homologação completa.

## Checklist visual

1. Selecionar **Azul** em Configurações e abrir Meus Leads.
2. Conferir bordas dos cards ativos, ícones, símbolos de nicho, filtros,
   linhas da tabela, hover e foco — todos em tons derivados do azul.
3. Alternar para Verde, Amarelo, Vermelho, Branco e Grafite;
   os mesmos componentes precisam mudar de cor sem novo deploy.
4. Conferir legibilidade nas seis opções e os contrastes dos botões.
5. Conferir que a estrela do favorito permanece dourada e a espera
   permanece âmbar, diferenciando estados do tema.
