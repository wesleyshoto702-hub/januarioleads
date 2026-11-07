# Diagnóstico e correção conservadora da aurora — 07/11/2026

## Objetivo e escopo

Investigar o travamento geral da homepage que começou após a aurora, medir o que está disponível e reduzir a concorrência entre o efeito decorativo e a resposta a cliques/rolagem. As alterações deste PR são **estritamente a variante 2D Canvas já testada**. A versão experimental com Web Worker permanece no PR #70 e não integra esta entrega.

## Causa provável, observada em laboratório

O Canvas 2D da aurora desenhava **cinco cortinas** a cada quadro, com muitos raios e caminhos Bézier. Cada raio criava um gradiente de cinco pontos e recebia três traços, multiplicando gradientes e operações de desenho. A animação acontecia na thread principal do navegador a 38 FPS no desktop/26 FPS no mobile. Quatro formas de brilho com CSS `filter: blur` também animavam e o cabeçalho usava `backdrop-filter` sobre o canvas em movimento.

**Isso é um forte candidato a causar travamento, não uma prova de exclusividade da causa:** com a preferência `prefers-reduced-motion: reduce` o browser também desativa outras animações, portanto a comparação não isola somente o Canvas.

## Evidência: Playwright Chromium em GitHub Actions

Duas execuções de laboratório no **mesmo fluxo de CI, mas em jobs diferentes**. São amostras curtas, com variação e possíveis diferenças de carga do runner; **não** equivalem a medições de campo ou benchmarking estatístico.

| Métrica do probe | Código anterior ao patch (commit 4e86ba0) | Variante conservadora validada (commit 5a3538b) |
|---|---:|---:|
| Desktop, gap entre frames P95, animação ativa | 283,4 ms | 116,7 ms |
| Mobile, gap entre frames P95, animação ativa | 83,3 ms | 49,9 ms |
| Desktop, gap P95 com movimento reduzido | 33,3 ms | 16,8 ms |
| Mobile, gap P95 com movimento reduzido | 16,8 ms | 16,8 ms |
| Desktop LCP de laboratório, daquela navegação | 968 ms | 872 ms |
| Mobile LCP de laboratório, daquela navegação | 412 ms | 296 ms |
| CLS sintético desktop | 0,0053 | 0,0053 |
| CLS sintético mobile | 0,013 | 0,013 |

**Cuidados:** P95 são intervalos de frames de um probe `requestAnimationFrame` (não FPS oficiais do Canvas); não use essas amostras para prometer uma porcentagem real de ganho. LCP e CLS são **somente de laboratório local**; o INP de campo depende de interações reais ao longo do tempo.

Links de prova: [commit base](https://github.com/wesleyshoto702-hub/januarioleads/commit/4e86ba0fee5311811bc45c2290c91b6f001390d0), [commit validado](https://github.com/wesleyshoto702-hub/januarioleads/commit/5a3538b3680eeced6a0d06488eab405b8a9a8092).

## O que foi otimizado

- Menos raios e redução de três para dois traços por raio, preservando as cinco cortinas e a paleta.
- Raios invisíveis são descartados antes do cálculo trigonométrico e da criação de gradiente.
- Redução do teto de pixels do canvas em telas retina e controle adaptativo da frequência de repintura.
- O desenho decorativo cede a thread durante scroll, toque, movimento da roda, clique ou digitação, retomando após inatividade.
- Camadas de brilho usam blur menor; o cabeçalho deixa de precisar recalcular o blur do fundo que se move.
- Permanecem o comportamento de movimento reduzido, pausa em aba oculta, camadas atrás do conteúdo e proteção contra overflow.

## Validação do commit conservador

- TypeScript e build de produção: **sucesso**.
- Catálogo, testes de aplicativo e build: **sucesso**.
- Testes de responsividade Firefox/WebKit: **sucesso**.
- Probe Playwright desktop/mobile: **sucesso**.
- Outros checks de segurança/isolamento: **sucesso**, exceto homologação de Auth local intencionalmente ignorada pela configuração do workflow.

## Status da medição em produção

A URL documentada no workflow do repositório é `https://januleads.vercel.app`. O probe Playwright, executado de forma externa ao deploy no GitHub Actions, recebeu **HTTP 404 na homepage `/`**, em desktop e mobile. A API pública do PageSpeed Insights respondeu **HTTP 429** (rate limit) para mobile e desktop.

**Consequência:** não foi possível confirmar sequer a homepage pública nessa URL, muito menos seus LCP/INP/CLS reais ou o deploy do commit. Não se deve atribuir valores de laboratório ao tráfego real.

Para concluir essa parte, é necessário localizar o domínio de produção ativo no painel Vercel, garantir deploy da `main`, confirmar HTTP 200 em `/` (e acesso público), e só então consultar CrUX/PageSpeed ou instrumentar Web Vitals com RUM. Se um domínio alternativo estiver ativo, atualizar `LIVE_SITE` no probe e no workflow de validação pública.

## Próxima oportunidade de otimização

A investigação experimental de Web Worker/OffscreenCanvas está isolada no PR #70. **Não mesclar sem CI bem-sucedido e verificação visual no navegador.** A variante conservadora mostrou melhora em amostras curtas, mas oscilações ainda são possíveis em computadores de menor desempenho.
