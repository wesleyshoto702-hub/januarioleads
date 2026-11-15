# Januário Leads — validação e preparação de homologação (15/11/2026)

**Status:** preparação somente. Importação Fase 9 V5 pelo Colab em andamento; **não executar migrations, backfills ou deploy na homologação enquanto houver importação ativa**, nem alterar produção.

## Trabalho 1 — nichos
- Catálogo canônico preservado: **216 nichos**.
- Correspondência Overture com categorias específicas: **162** (125 antes, +15 na etapa 3, +22 na etapa 4).
- **54 ainda não possuem correspondência exata**: continuar por evidências, sem categorias genéricas como `school`, `professional_service`, `animal_or_pet_service` ou `shopping`.
- Auditoria baseada em SQL **SELECT somente** na tabela `public.overture_places` do projeto `prlrxjothrslhswpkoza`. Contagens representam snapshot em importação, não cobertura garantida em todos os municípios.

## Trabalho 2 — integração
- Esta branch integra alterações lógicas das PRs #146 (janela estável e limitada de candidatos) e #147 (novos mapeamentos) mais etapa 4.
- Busca lê no máximo **3 páginas x 100 registros** por cidade/nicho, sempre `order=id.asc`, antes de classificar contatos e paginar 20 ao usuário. Não equivale a pesquisa completa do banco.
- Falha de qualquer página → resultado `UNAVAILABLE` (fail-closed), evitando resposta parcial mascarada de completa.
- Foram incluídos testes offline cobrindo ordenação por contatos, falha de página posterior, limite de leituras, 216 rótulos e 162 nichos mapeados.
- Foi incluído workflow PR offline e sem segredos para rodar verificações específicas do Overture.
- **Não tratar resultado total como contagem nacional exaustiva**; só há uma janela limitada, sobretudo após crescerem as capitais.

## Trabalho 3 — amostragem real (homologação, SQL SELECT)
Conferência agregada, somente leitura, feita durante a importação:

| Município | Registros Overture presentes | Com telefone preenchido | Com e-mail preenchido | Com site preenchido | Categorias distintas |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lavras/MG | 30 | 30 | 30 | 30 | 20 |
| Varginha/MG | 30 | 30 | 30 | 18 | 26 |
| Belo Horizonte/MG | 180 | 180 | 180 | 156 | 76 |
| São Paulo/SP | 180 | 180 | 180 | 156 | 85 |

Exemplos exatos observados: Lavras tem 4 registros `dental_clinic`, 1 `gym` e 1 `restaurant`; Belo Horizonte tem 3 `barber`, 4 `gym`; São Paulo tem 2 `barber` e 4 `gym`. Contatos preenchidos **não equivalem a contatos confirmados como autênticos**.

**Conclusão:** cobertura municipal ainda é amostral. A ausência de resultados pode resultar de importação parcial, não necessariamente falha de mapeamento. Não chamar APIs comerciais para preencher lacunas sem orçamento/autorização explícitos.

## Trabalho 4 — checklist para homologação
1. Aguardar confirmação explícita do usuário de que a Colab Fase 9 V5 terminou. Não executar importadores paralelos.
2. Conferir resultado final `FINAL` e capacidade livre de armazenamento. Fazer somente inspeção read-only e revisar logs de erro, sem expor tokens.
3. Garantir sucesso do teste focado de Overture + catálogo; revisar também CI geral. A suíte geral já tinha falhas não relacionadas (baseline migrations); **não** consertar baseline na homologação durante a Colab.
4. Revisar manualmente a PR #148 e mesclar na `main` **somente após testes e autorização**. PRs #146 e #147 não devem ser mescladas de forma independente em seguida sem reconciliação.
5. Verificar alterações de `search-places` já implantadas em homologação (versão 29 relatada em auditoria) e identificar a versão/commit atual. Como `_shared/overture-search.ts` é dependência da função, não pressupor que atualizar GitHub atualize Supabase.
6. Fazer deploy **apenas da Edge Function `search-places` em homologação**, preservando JWT e limites fail-closed, somente após revisão; não publicar em produção.
7. Em homologação, testar nichos novos por município (com e sem dados), 20 resultados por página, filtros, provenance, erros e latência. Confirmar que nenhuma chamada Google/Geoapify sem autorização ocorreu.
8. Registrar versões, evidências e rollback: antes do deploy, guardar commit funcional + versão antiga da Edge Function; se falhar, restaurar a versão anteriormente aprovada.
9. Frontend não é publicado automaticamente. Separar publicação do frontend e do backend, evitando divergência entre ambiente staging e produção.

## Bloqueadores e critérios de aprovação
- CI geral está bloqueado historicamente por auditoria de migrations que espera 24 e encontra 42 arquivos locais no snapshot do workflow #43731102268; isso não foi causado pelo mapeamento de nichos.
- Apenas testes simulados e consultas SQL agregadas foram feitos nesta rodada. **Não foi realizado teste real de chamadas Edge Function, deploy nem browser conectado à homologação.**
- Integração de 162 nichos e ranking precisam de validação de carga/leitura do Supabase depois da importação, antes da ativação.
