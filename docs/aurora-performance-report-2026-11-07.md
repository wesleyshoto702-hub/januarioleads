# PERFORMANCE REPORT — Aurora e Core Web Vitals
Data: 07/11/2026. Fonte: GitHub Actions + Chromium automatizado (ambiente de desenvolvimento) + tentativa externa no domínio de produção configurado.

## 1. Diagnóstico

A homepage ficou lenta após adicionar a aurora Canvas. O componente desenhava cinco cortinas com muitas operações de `Math.sin`, gradientes individuais e três traços por raio, redesenhados continuamente. Quatro camadas CSS animadas com filtros `blur()` e um cabeçalho com `backdrop-filter` adicionavam trabalho de composição.

O teste comparou o mesmo browser com movimento normal e com `prefers-reduced-motion: reduce`. Essa comparação também pausa outras animações, então sugere, mas **não prova isoladamente**, que 100% do custo seja da aurora.

## 2. Medidas de laboratório (não são métricas reais de usuários)

Teste automatizado, Chromium em GitHub Actions, viewport 1440×900 (desktop) e 390×844 (mobile). O indicador **P95 de intervalo entre frames** é um proxy de fluidez da página no ambiente de teste, não um Core Web Vital.

| Cenário | P95 desktop | P95 mobile |
| --- | ---: | ---: |
| Antes da correção, animações ativas (commit 4e86ba0) | 283,4 ms | 83,3 ms |
| Antes da correção, movimento reduzido | 33,3 ms | 16,8 ms |
| Após correção conservadora, animações ativas (commit 5a3538b) | 116,7 ms | 49,9 ms |
| Após correção, movimento reduzido | 16,8 ms | 16,8 ms |

As medições foram feitas em execuções diferentes e podem oscilar com o hardware do runner. O teste também registrou cenários com resultado diferente: o desktop ficou entre aproximadamente 116 e 183 ms em runs de ajuste, e o mobile variou mais. Portanto, a correção **reduz carga de desenho, mas não garante ausência completa de travamentos**.

Core Web Vitals de laboratório da versão conservadora candidata (não do site publicado):
- Desktop: LCP **872 ms**, CLS **0,0053**.
- Mobile: LCP **296 ms**, CLS **0,013**.
- **INP de usuários reais:** não medido. O click sintético de teste com movimento reduzido marcou 32 ms desktop / 24 ms mobile; não é uma medida representativa de INP.
- Em ambos os ambientes acima, os números de LCP e CLS são de execução local de desenvolvimento, não representam distribuição real no site publicado.

Referência para metas de experiência: LCP até 2,5 s, INP até 200 ms e CLS até 0,1, avaliados no percentil 75 de usuários reais.

## 3. Produção e PageSpeed Insights

A URL publicada registrada no projeto é `https://januleads.vercel.app/`. O Chromium externo no GitHub Actions recebeu **HTTP 404** nessa rota, tanto em mobile quanto desktop. O Google PageSpeed Insights retornou **HTTP 429** (limitação do serviço). Assim, **não é possível confirmar publicação atualizada nem LCP/INP/CLS reais em produção** sem identificar o domínio correto/ativar o deploy e consultar dados CrUX ou adicionar medição RUM com consentimento.

## 4. Correções implementadas e validadas

- Redução da densidade dos raios Canvas (desktop 7→12 px; mobile 10→16 px), mantendo cinco cortinas animadas.
- Redução de três para dois traços por raio, mantendo halos e filamentos luminosos.
- Interrupção precoce de raios quase transparentes antes de cálculos trigonométricos e gradientes.
- Limite adaptativo de repinturas e da resolução da bitmap, com prioridade para fluidez da interface.
- Pausa temporária da repintura durante rolagem, toques, cliques e digitação; animação retoma depois.
- Camadas de brilho CSS com desfoque menor e remoção do `backdrop-filter` no cabeçalho sobre a aurora animada.
- Preservação de `prefers-reduced-motion`, de camadas inferiores, cores, texto e navegação.
- Teste de regressão: o Canvas não atualiza durante uma sequência de scroll e volta a se mover quando a interação termina.
- CI do commit 5a3538b: TypeScript, build, navegador e testes de responsividade **passaram**.

## 5. Próxima melhoria e limite de segurança

Foi criada em um branch separado uma versão experimental baseada em `OffscreenCanvas` + Web Worker, para tirar o cálculo dos raios da thread principal. **Não foi integrada**, porque os jobs do GitHub Actions associados a ela falharam antes de começar qualquer etapa (sem logs/steps de execução). Não é seguro distribuir essa alteração sem validação em browsers e CSP.

Para concluir a tarefa de métricas **reais**: confirmar o domínio e o deploy Vercel, medir URLs com acesso HTTP 200 no PageSpeed/CrUX ou RUM, comparar várias sessões reais em desktop/mobile e verificar acessibilidade/visual. Não inferir INP real de apenas um clique automatizado.
