# Januário Leads — Fase 1.5a: duplicações, filiais e precisão estrutural dos contatos

**Data:** 15/11/2026 | **Banco auditado:** somente `public.overture_places` da HOMOLOGAÇÃO `prlrxjothrslhswpkoza`. **Tamanho do snapshot:** 321.179 registros.

**Escopo seguro:** SQL `SELECT` agregado, sem mostrar nomes de empresas, endereços, contatos individuais ou IDs; revisão do algoritmo de `supabase/functions/_shared/overture-search.ts`; testes Deno com lugares **totalmente fictícios**. **Nenhuma escrita, nenhum deploy Supabase, nenhuma alteração em produção/Colab ou uso de Google Places/Geoapify.** A Fase 0 continua adiada **e não resolvida**.

**Reprodução:** [SQL somente leitura](../scripts/fase1-5-auditoria-duplicacoes-contatos-readonly.sql) + [fixture agregada](../tests/fixtures/fase1_5_aggregate_quality_summary.json) + testes `tests/fase1_5_conservative_dedup_offline.test.ts` e `tests/test_fase1_5_quality_offline.py`.

## 1. IDs, nomes e possíveis filiais

| Indicador | Medição |
|---|---:|
| IDs Overture no banco / IDs distintos | **321.179 / 321.179** |
| Registros sem `name_key` útil para agrupamento | **127** |
| Grupos do mesmo `name_key + UF + município` em 2+ linhas | **6.864** |
| Linhas nesses grupos | **13.854** |
| Linhas que seriam ocultadas se juntássemos só por nome/cidade | **6.990** |
| Grupos com coordenadas arredondadas diferentes | **6.655** |
| Grupos com mais de um endereço conhecido distinto | **2.812** |
| Grupos com categorias diferentes | **1.133** |

**Conclusão:** IDs são exclusivos neste snapshot, mas nomes repetidos e telefones compartilhados não são prova de duplicação. Pode haver filiais, franquias, negócios diferentes no mesmo prédio e erros de geocodificação. **Proibido apagar registros ou unir automaticamente pelo nome.**

## 2. Distância real entre nomes repetidos (até 15 metros)

Pares construídos somente dentro do mesmo `name_key + UF + cidade`, com caixa angular máxima de 0,002° e distância de Haversine. **São pares de registros, não número de empresas duplicadas**; os critérios de endereço foram normalizados aproximadamente em SQL e podem diferir da normalização TypeScript.

| Indicador | Pares |
|---|---:|
| Mesmo nome, município, até 15 metros | **276** |
| Endereços conhecidos divergentes | **149** |
| Categorias diferentes | **68** |
| Telefones presentes divergentes | **22** |
| Pelo menos um dos conflitos acima (união) | **209** |
| Sem conflito identificado nesses campos | **67** |

Os três tipos de conflito **se sobrepõem**: não somar 149+68+22. Dos 276 pares próximos, 209 (**75,7%**) têm pelo menos uma divergência explícita, o que significa risco real de **ocultar negócios distintos** se deduplicarmos apenas por nome + proximidade. Os **67 restantes também não são "duplicatas confirmadas"**; falta verificação independente. Risco maior que sub-repetição? Neste estágio, **preservar candidatos ambíguos** é preferível a esconder filiais legítimas.

### Correção preparada — NÃO publicada

O leitor `isSameLocatedOvertureBusiness` agora:
1. Reconhece o mesmo ID Overture como o mesmo registro.
2. Exige nome equivalente para comparar IDs diferentes.
3. **Não funde** quando ambas as categorias presentes divergem.
4. **Não funde** quando ambos os endereços conhecidos divergem.
5. **Não funde** quando ambos os telefones preenchidos divergem após retirar pontuação.
6. Só considera proximidade de até 15 metros **na ausência desses conflitos**; sem coordenadas válidas, exige o mesmo endereço conhecido.

Regra conservadora. Pode deixar alguns cadastros efetivamente duplicados (por contatos desatualizados/erros de endereço) para revisão posterior; isto é explicitamente preferível a descartar uma empresa distinta. Nenhuma linha foi apagada ou alterada. O código foi preparado no GitHub e será testado **com sessão autenticada** somente depois de resolver a Fase 0. A função publicada de staging ainda possui a regra anterior.

## 3. Telefones e e-mails compartilhados — revisão, NÃO remoção

| Indicador | Medição |
|---|---:|
| Grupos de telefone normalizado em 2+ registros | **9.658** |
| Registros com telefone compartilhado | **22.034** |
| Grupos de telefone em 10+ registros | **42** |
| Registros envolvidos nesses grupos de 10+ | **2.117** |
| Maior número de registros compartilhando um telefone | **483** |
| Grupos de e-mail repetido em 2+ registros | **7.159** |
| Registros com e-mail compartilhado | **15.299** |
| Grupos de e-mail em 10+ registros | **16** |
| Registros envolvidos nesses grupos de 10+ | **624** |
| Maior repetição de um e-mail | **190** |

**Não presumir fraude ou dados falsos**: centrais, franquias, representantes, e-mails corporativos e contatos de terceiros são possíveis. Campos de pessoa identificável exigem análise LGPD e, quando necessário, mecanismo de correção/oposição.

## 4. Formato de telefones, sites e Instagram

| Indicador | Medição |
|---|---:|
| Telefones preenchidos | **296.652** |
| Telefones com 10–11 dígitos ou 12–13 iniciados por +55 (apenas formato) | **296.064** |
| Telefones fora desse critério | **588** |
| Telefones formados por um dígito repetido | **1** |
| E-mails preenchidos, sintaxe básica aparentemente válida | **228.277** |
| E-mails com falha no padrão sintático básico testado | **0** |
| Sites preenchidos | **128.850** |
| Sites com URL HTTP(S) estruturalmente inadequada | **1** |
| Sites cuja URL aponta a Instagram, Facebook, wa.me ou Linktree | **3** |
| Referências de Instagram preenchidas | **42.742** |
| Referências que não seguem formato HTTP(S) de Instagram testado | **5** |
| Links apontando para publicações, reels, stories, Explore e TV | **618** |
| Links para a raiz `instagram.com` (sem perfil) | **182** |
| Links com caminho de apenas um segmento (candidatos, não confirmação) | **41.094** |

**Cuidado metodológico:** estes grupos têm sobreposições possíveis, e a correspondência a um perfil real depende de regras adicionais (nome de usuário válido, páginas reservadas, URL, titularidade). O validador `canonicalPublicInstagram` já rejeita postagem, Explore, diretórios e raiz, e devolve apenas um **candidato** com confiança `medium`, sem evidência de propriedade. Os novos testes offline cobrem cenários maliciosos e não-perfis.

**Padrão BR mínimo** não valida DDD, operadora, atividade, titularidade, existência de linha ou presença no WhatsApp. `website` com sintaxe válida não verifica que o domínio carrega nem se pertence à empresa. Sintaxe de e-mail também não garante entrega. **Nunca anunciar `Com WhatsApp`, `Instagram oficial` ou `Sem site` como informação verificada com base apenas nessas fontes**; os textos da UI e as validações mais rigorosas permanecem para etapas posteriores.

## 5. Testes e portões

- [x] Verificar IDs únicos e lacunas de normalização `name_key`.
- [x] Medir repetições por nome/município, 15m, conflito entre endereço/categoria/telefone.
- [x] Medir telefones e e-mails repetidos sem exportar os dados reais.
- [x] Auditar padrões de telefone BR, sintaxe básica de website, e-mail e Instagram.
- [x] Preparar correção conservadora no algoritmo de deduplicação e regressões sintéticas.
- [ ] Comprovar que o deduplicador atualizado não causa regressões **na interface autenticada**, incluindo paginação e favoritos/CRM, depois da Fase 0.
- [ ] Verificar titulares, estabelecimentos reais, site funcional e perfis oficiais por meios autorizados; **nenhum contato foi externamente verificado**.
- [ ] Corrigir rótulos de UI que confundam `telefone utilizável` com `WhatsApp ativo` e `site não informado` com ausência comprovada. Testes reais dependem da Fase 0.
- [ ] Testar procedência/licenças/retenção de dados de provedores antes de comercializar.
- [ ] Confirmar a revogação da antiga `service_role` de staging, backup e restauração de produção. Não liberar deploy/migração/beta até então.

**Status:** **Fase 1.5a (auditoria quantitativa, código preparado e testes offline) CONCLUÍDA após CI**, **Fase 1.5b (validação de dados reais e busca autenticada) PENDENTE**.

**Próxima ação segura pelo celular:** iniciar **Fase 2.1a — testes offline do fluxo Buscar Leads com fontes simuladas**, sem acessar credenciais e sem publicar. A **Fase 2.1b (teste E2E com usuário real)** e o fechamento definitivo da Fase 1 exigem retomada da Fase 0, inclusive a revogação do segredo comprometido. Não converter avaliações internas em promessa de 600 mil empresas verificadas.
