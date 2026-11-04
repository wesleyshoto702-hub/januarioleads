# Auditoria responsiva do JanuarioLeads — 04/11/2026

## Contexto

- Produto: SaaS CRM de prospecção comercial com dashboard.
- Stack: React 19, TanStack Start, TypeScript, CSS modular e Playwright.
- Interface preservada: tema escuro/claro, vermelho institucional, menu lateral,
  todos os sete módulos e fluxos de autenticação/salvamento.
- Commit base auditado: `95a3d0b777784ab689e4243ddfb588dd6415b84d`.
- Escopo: frontend somente; **sem alterar Supabase, Edge Functions ou dados de leads**.

## Problemas encontrados e resolvidos

1. **Overflow horizontal efetivamente comprovado em "Abertos Agora"** nos
   testes de 768, 1024 e 1280 px (em uma rodada antes do ajuste de layout,
   também em 1440 px). A causa era a largura mínima implícita do grid e a
   soma das colunas do painel de filtros ao lado da barra lateral. Corrigimos
   com `minmax(0, 1fr)`, redução de colunas por espaço e ações em linha
   separada. A regressão é detectada automaticamente pelo Playwright.
2. **Tipografia excessivamente compacta**: muitas informações em 8–10 px em
   painéis e módulos de oportunidades/empresas abertas. Melhorada a legibilidade
   das métricas, rótulos, ações, estados vazios e descrições sem perder a
   hierarquia original.
3. **Áreas touch inferiores a 44 px** em navegação, abas de mensagens,
   favoritos e botões de filtros; ajustadas nos layouts mobile.
4. **Menu móvel com limitações no modo paisagem**: drawer rolável,
   travamento do scroll de fundo, fechamento com Escape, foco restaurado,
   navegação por Tab dentro do drawer e fechamento ao passar ao desktop.
5. **Cards e formulários apertados**: grids fluídos e `min-width: 0`,
   textos longos quebram sem vazar; inputs com no mínimo 16 px em
   telas móveis para evitar zoom automático de foco no Safari iOS.
6. **Dashboard em 320 px**: métricas não se empilham em cinco cartões altos;
   usam duas colunas, com a última métrica ocupando toda a largura.
7. **Diálogos mobile**: altura limitada a `dvh`, scroll interno e
   botões preservados, sem sobrepor barras de sistema.

## Breakpoints por necessidade real

| Condição | Objetivo |
|---|---|
| Até 360 px | Smartphones compactos: métricas em duas colunas e ações de cards em uma |
| Até 620 px | Telefones: conteúdo e formulários empilhados, botões de 44 px |
| Até 760 px | Módulos de pesquisa, CRM e oportunidades com grids de uma coluna |
| Até 900 px | Navegação em drawer mobile/tablet (incluindo paisagem) |
| 901–1040 px | Notebook estreito: dashboard e filtros evitam colunas comprimidas |
| Até 1080/1400 px | "Abertos Agora": painel de filtros distribui ações segundo espaço disponível |
| Acima de 1400 px | Conteúdo centralizado e limitado, sidebar completa, painéis fluidos |

Não foram criados breakpoints indiscriminados; os valores especializados
seguem restrições de conteúdo de cada módulo.

## Provas de responsividade

- O script `tests/browser/responsive.spec.ts` percorre Dashboard, Meus
  Leads, Buscar Leads, Oportunidades, Abertos Agora, Mensagens e Financeiro
  em **320, 375, 390, 430, 768, 1024, 1280, 1440 e 1920 px**, sem
  chamar APIs reais (Supabase é simulado).
- Além disso, testa modal de cadastro em 320 px, drawer em paisagem
  844 × 390 px e áreas de toque em 390 px.
- `.github/workflows/niche-catalog-check.yml` executa o conjunto em
  Chromium junto a testes de tipos, build e banco isolado.
- `.github/workflows/responsive-cross-browser.yml` traz conferência
  complementar com Firefox e WebKit (simulação de engine Safari) em
  larguras selecionadas. Playwright **não substitui** testes em aparelhos
  reais, sobretudo Safari iOS e Android de fabricantes diferentes.
- Capturas de dashboard, geradas pelos testes, podem ser obtidas nos
  artefatos da execução cross-browser.

## Checklist

- [x] Menu lateral e menu móvel responsivos.
- [x] Sem overflow horizontal nos sete módulos e nove larguras em Chromium.
- [x] Grids de dashboard, CRM, busca, oportunidades, mensagens e financeiro.
- [x] Touch targets principais de 44 px em dispositivos móveis.
- [x] Formulários com tipografia segura no iOS.
- [x] Diálogos e orientação paisagem com navegação funcional.
- [x] Identidade visual, temas, conteúdos e funcionalidades preservados.
- [ ] Conferência manual em dispositivos reais Safari iOS, Chrome Android e Edge Windows.
- [ ] Publicação/versão exata do frontend no Lovable/Vercel verificada após o merge.
- [ ] Testes com Auth, dados e integrações reais de homologação (fora do
  escopo da responsividade).

## Não fazer

- Não adicionar `overflow-x: hidden` ao `body` para mascarar bugs.
- Não mexer em migrations, Auth, API keys e dados de clientes.
- Não remover informações para forçar encaixe visual.
