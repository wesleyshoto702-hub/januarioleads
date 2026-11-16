# Januário Leads — Fase 2.4a: observabilidade e baseline SINTÉTICO da busca

**Data-base:** 15/11/2026 | **Ambiente:** apenas código e GitHub Actions offline, com horários injetados/retornos fictícios. **Não é métrica real de homologação ou produção.**

**Segurança:** Fase 0 ADIADA/NÃO CONCLUÍDA: revogação da chave `service_role` antiga de homologação ainda não comprovada, e backup/teste real de restauração de produção pendentes. Não houve consulta real de empresas, chamada a Geoapify/Google, deploy Supabase, escrita no banco, Colab, mudança de RLS, publicação ou lançamento.

## 1. Instrumentação no código real, sem dados empresariais

- Criado `src/features/search-leads/search-metrics.ts`: percentil **nearest-rank**, contagem de respostas positivas/negativas e percentual de falhas, número de tentativas HTTP, classes de status, número de resultados entregues e páginas iniciais/continuações.
- `requestSearchBusinesses` (fluxo já chamado pela UI) aceita `onObservation` e `clockNowMs` opcionais. Começa a cronometrar antes das verificações locais, conta tentativas somente quando `fetch` é realmente invocado, e registra HTTP 2xx/4xx/5xx ou nenhum status se a chamada é impedida ou interrompida. Requisições sem sessão e tokens inválidos são contadas como **ações falhas sem tentativa HTTP**.
- `SearchLeadsView.tsx` injeta coletor **somente na memória do componente**, sem console, banco, storage, upload, processo em segundo plano ou painel exposto. Os dados são descartados ao desmontar. Erro no observador não altera o resultado da busca.
- A janela retém no máximo **256 observações** por padrão e **1000** mesmo quando configurada com capacidade maior. p50/p95 e taxa de erros são calculadas **sobre o histórico retido**, não sobre todo o tráfego, não sobre números de empresas e não sobre a cidade inteira. `null` indica falta de amostras.
- Não se registra nome de empresa, município, UF, telefone, e-mail, número de documento, `placeId`, parâmetro de busca, corpo de resposta, token JWT, chave pública, IP ou identificador de usuário. **A função de observação recebe apenas seis valores pré-definidos**: tipo de página, resultado em enum, duração numérica, tentativas 0/1, classe HTTP e quantidade de resultados.

## 2. Baseline reproduzível, exclusivamente SIMULADO

Rodar:
```bash
deno test tests/fase2_4a_search_metrics_offline.test.ts
deno check tests/fase2_4a_search_metrics_offline.test.ts
python -m unittest discover -s tests -p test_fase2_4a_search_observability_offline.py -v
```

Relógio fake: 10 chamadas sem rede com duração **10,20,30,40,50,60,70,80,90,100 milissegundos** e falhas simuladas em 40ms e 100ms.

| Indicador | Valor **SIMULADO** |
|---|---:|
| Requisições HTTP mockadas | **10** |
| Sucessos mockados | **8** |
| Falhas mockadas (quota HTTP 429) | **2** |
| Taxa de falha sintética | **20%** |
| p50 de todas as 10 ações | **50 ms** |
| p95 de todas as 10 ações | **100 ms** |
| p50 das 8 ações bem-sucedidas | **50 ms** |
| p95 das 8 ações bem-sucedidas | **90 ms** |
| Resultados fictícios retornados com sucesso | **8** |

O teste também prova:
- token `overture:100` inválido e sessão ausente → **zero** tentativas HTTP;
- quota 429 → uma tentativa e código correto;
- exceção de rede → uma tentativa sem status HTTP;
- erro no callback de telemetria → **não** impede a busca;
- janela de 1000 amostras, p95 determinístico e limpeza ao fim da sessão;
- retorno de observações não contém quaisquer valores privados do payload simulado.

**Atenção:** os percentis são impostos artificialmente por um relógio controlado. **Não se pode concluir que Januário Leads responde em 50/100 ms**, nem extrair SLA de produção, queda de latência ou capacidade nacional com esses resultados.

## 3. Volume e oportunidades técnicas

O leitor Overture atual consulta no máximo **250 candidatos brutos** em uma chamada PostgREST com filtros de categoria exata, `state`, `city_key` e `order=id.asc`, reordena/deduplica localmente, e devolve páginas de até **20 leads**, limitadas a deslocamentos 0/20/40/60/80.

No ensaio de **125 estabelecimentos fictícios**: **5 leituras internas** Overture para exibir **100 resultados** e **zero chamadas Geoapify/Google dentro desse caminho simulado**. Como a janela bruta de até 250 candidatos é refeita ao pedir cada página, o teto teórico ao percorrer cinco páginas é **até 1250 linhas brutas transferidas/reprocessadas cumulativamente**, caso haja essa quantidade, não 1250 empresas distintas e não um volume observado na produção.

A aplicação já bloqueia clique duplo para o mesmo token e buscas antigas, conforme Fase 2.2a. O filtro de resultados opera na memória do navegador (Fase 2.3a). O novo observador permite avaliar posteriormente o custo de páginas mais longas **sem exigir uma consulta por filtro**.

### Recomendações de otimização, ainda NÃO executadas

1. **Após Fase 0:** medir p50/p95 reais com uma conta de teste autorizada e fonte Overture, em desktop/mobile, **mantendo fornecedores pagos desativados**. Usar relógio monotônico para latência e métricas agregadas sem PII.
2. Verificar índices efetivos em `overture_places` para `state`, `city_key`, `category`, `id` e seletividade; usar `EXPLAIN (sem ANALYZE)` primeiro em homologação autorizada; não criar índices sem medir espaço, lock e plano. Evitar planejamento baseado somente no número de 321.179 linhas.
3. Estudar **cursor/paginação SQL ou cache seguro por query** para não transferir/reprocessar os mesmos até 250 candidatos por clique; **não alterar ordenação/qualidade/deduplicação sem regressões** e sem prova de compatibilidade.
4. Medir separadamente no backend as chamadas de **Overture**, **Geoapify** e **Google** para faturamento seguro. O observador HTTP do cliente conta **uma chamada ao endpoint search-places**, não quantos fornecedores/queries o servidor acionou. Logo, **não comprova 0 chamadas pagas em ambiente real**.
5. Qualquer coleta central futura exige avaliação LGPD, retenção mínima, autenticação e aprovação explícita de custo; não reutilizar tokens, termos de busca nem contatos como etiquetas de métricas.

## 4. Portões do Plano Mestre

- [x] Fase **2.4a** — instrumentação PII-free, percentis p50/p95, falhas e volume **de consultas de cliente** com mocks, testes/regressões offline e relatório.
- [ ] **2.4b** — baseline real autorizado, diagnóstico dos índices e otimização paginada comprovada, testes de estresse limitados, validação do volume/latência do servidor e rollback. **Bloqueado pela Fase 0**.
- [ ] Fase **2.5a** — próxima ação segura: cenários fictícios do CRM, de **Buscar → Salvar → Favoritar → Status → Próximo contato**, integridade de IDs e isolamento offline, **sem banco real**.
- [ ] Fase **2.1b/2.2b/2.3b** — navegador autenticado + CRM/RLS só depois de revogar chave antiga, proteger staging e realizar backup/ensaio de restauração de produção.
- [ ] Corrigir falhas históricas no CI de migrations e teste HttpOnly antes de um beta; não confundir CI específico com liberação global.

**Condição de conclusão:** workflow próprio 2.4a, regressões 2.1a/2.2a/2.3a/1.5 e build TypeScript aprovados. Se não estiverem verdes, a Fase 2.4a não deve ser anunciada concluída.
