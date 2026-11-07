# PERFORMANCE REPORT — Januário Leads

Data: 07/11/2026  
Skill aplicada: `Code Performance` v1.0.0 (Code Makers).  
Escopo: homepage, autenticação e CRM na stack React 19 + TanStack Start + Vite 8, Supabase, navegadores móveis e desktop.

## 1. Resumo

**Estado geral:** melhorias aplicadas em um PR; não há medição de Web Vitals em produção nesta auditoria.

**Gargalos verificáveis no código antes das alterações:**
- CSS das páginas públicas, autenticação e área interna aparecia em todas as rotas, via `src/routes/__root.tsx`.
- O módulo `/app` importava Busca, Oportunidades, Financeiro e Mensagens diretamente, embora a UI exiba uma aba por vez.
- `visibleLeads.map(...)` gerava cartões para todos os leads tanto no DOM desktop quanto mobile; o Kanban também montava todos os cartões de uma vez.
- A aurora consultava largura e altura calculadas do canvas a cada frame e repetia cálculo de deriva que era constante em cada cortina.

**Prioridade**: ALTA para CSS e carregamento de módulos; ALTA para DOM com carteiras grandes; MÉDIA para a otimização de CPU da aurora.

## 2. Baseline e comparação medidos

Fonte: logs do **build de produção** (`bun run build`) executado por GitHub Actions.

| Indicador | Antes (`main` fc46b3e) | Depois (PR #69) | Interpretação |
| --- | ---: | ---: | --- |
| Chunk client `app-*.js` (transferência sem compressão) | 282,74 kB | 108,41 kB | **-61,7% de bytes deste arquivo** |
| Chunk client `app-*.js` (gzip) | 80,86 kB | 30,54 kB | **-62,2% de bytes deste arquivo em gzip** |
| CSS global `styles-*.css` | 180,47 kB | 180,91 kB | +0,44 kB pelos controles de paginação |
| CSS global `styles-*.css` (gzip) | 29,36 kB | 29,43 kB | +0,07 kB |
| Chunk partilhado `index-*.js` | 334,44 kB | 334,76 kB | Sem ganho relevante; permanece como limitação |

**Nota de interpretação:** a redução no chunk `app` não equivale à redução do JavaScript total baixado ou do tempo de carregamento. O build passou a gerar outros chunks dinâmicos e compartilhados. Não é apropriado somar tamanhos sem conhecer o waterfall real de cada rota. 

Novos chunks observados: `SearchLeadsView` 29,23 kB, `OpportunityView` 13,63 kB, `FinanceView` 3,71 kB e `MessagesView` 49,10 kB (tamanhos sem gzip). Existe também chunk compartilhado `whatsapp` de 70,08 kB. Carregamento real depende de navegação, preloads do framework e cache do navegador.

### Core Web Vitals

| Métrica | Antes | Depois | Estado |
| --- | --- | --- | --- |
| LCP | Não medido | Não medido | Pendente de ambiente real/RUM |
| INP | Não medido | Não medido | Pendente de interação real/RUM |
| CLS | Não medido | Não medido | Pendente de ambiente real/RUM |
| FCP, TTFB e TBT | Não medidos | Não medidos | Não inventar resultados |

**Links internos dos trabalhos:** baseline: [build da main](https://github.com/wesleyshoto702-hub/januarioleads/commit/fc46b3e2617ac086f4a35d958c2f9272b454da46); código otimizado: [PR #69](https://github.com/wesleyshoto702-hub/januarioleads/pull/69).

## 3. Correções implementadas

1. **CSS por rota:** estilos compartilhados permanecem no root; os estilos de marketing, autenticação e CRM só são referenciados pelo head da rota apropriada. A ordem da cascata foi mantida dentro de cada grupo.
2. **Carregamento sob demanda:** os componentes de Busca, Oportunidades, Mensagens e Financeiro usam `React.lazy` com `Suspense`. O Dashboard continua disponível imediatamente.
3. **DOM de carteiras grandes:** busca e ordenação continuam aplicadas à carteira completa, mas Lista e Kanban montam inicialmente até 40 empresas, com controle para carregar mais 40. Contagens, filtros, ações e dados persistidos permanecem intactos.
4. **Aurora:** mantém cinco cortinas, cores, tamanhos, velocidade e FPS originais; dimensões do canvas são consultadas ao redimensionar, e deriva comum a uma cortina passa a ser computada uma vez por frame.

## 4. Integridade e regressão

- Build Vite/TanStack Start de produção e `tsc --noEmit` verificados.
- GitHub Actions (PR #69, código): **95 testes Playwright passaram, 1 foi ignorado**, **124 testes unitários passaram, 0 falharam**; verificação de responsividade em múltiplos navegadores e build de produção concluídos com sucesso.
- Testes automatizados adicionais: CSS presente apenas nas rotas correspondentes; aurora preservada; renderização de 40 e 80 leads; filtros de carteira e comportamento do Kanban.
- Manutenção de `prefers-reduced-motion` e pausa da aurora em aba oculta.
- Sem alterações na identidade vermelha/preta, textos, regras de negócio, migrations, autenticação ou dados financeiros.
- Importância da validação visual manual após deploy: home em mobile e desktop, modal de lead, mudança de abas e lista com mais de 40 registros.

## 5. Pendências e riscos

- **LCP/INP/CLS em usuários reais:** medir pela aplicação publicada (Chrome UX Report, RUM ou ferramenta autorizada) em mobile/desktop, antes de anunciar ganho de velocidade percebida.
- **Rede e cache:** obter waterfall e headers HTTP reais de produção antes de alterar CDN/cache/TTFB, pois não foram inspecionados.
- **Backend/Supabase:** observar latência, paginação e duplicidade de requests antes de modificar queries ou esquema.
- **Chunk compartilhado `index`:** investigar com profile de build/waterfall, sem substituir bibliotecas por hipótese.
- **Fontes:** duas famílias externas com preconnect e `display=swap`; validar LCP/CLS em dispositivo real antes de aplicar preload ou migrar fontes.
- **Imagens e vídeos:** nenhum ativo de mídia grande foi identificado na árvore `public`; avaliar outros conteúdos remotos se houver dados de rede reais.

## 6. Critério de aceite

Aprovado tecnicamente quando TypeScript, build, testes browser e responsividade passam no PR, com CSS das rotas corretamente isolado e fluxo do CRM preservado. **Isso não substitui medições LCP/INP/CLS em produção.**
