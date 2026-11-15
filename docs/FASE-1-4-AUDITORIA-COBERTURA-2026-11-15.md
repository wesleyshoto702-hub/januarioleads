# Januário Leads — Fase 1.4: diagnóstico nacional de cobertura por município e nicho

**Execução:** 15/11/2026 | **Ambiente:** SOMENTE HOMOLOGAÇÃO `prlrxjothrslhswpkoza` | **Fonte:** `public.overture_places` com 321.179 registros e código de mapeamento Fase 1.3 na `main`.

**Segurança:** Fase 0 ADIADA/NÃO CONCLUÍDA. **Nenhuma escrita no Supabase, publicação de Edge Functions, migração, mudança em produção, Colab, chamada a API externa ou uso de segredos.** Só `SELECT` agregados e arquivos/documentação no GitHub. Esta auditoria pode embasar desenvolvimento offline, não autoriza beta/lote de produção.

## 1. Pergunta respondida

O que um usuário pode esperar ao pesquisar um nicho específico numa cidade? Na base Overture existente, a abrangência por município **não implica** quantidade útil por nicho. A Fase 1.3 abriu mais opções de busca, mas a densidade por par município×nicho permanece baixa.

Foram avaliadas todas as **216 opções de nicho × 5.572 localidades distintas por (UF, city_key)**, total **1.203.552 combinações**; 27 UFs representadas. As localidades vêm das chaves existentes no banco, não foram geocodificadas ou validadas contra fonte oficial nesta etapa.

### Critérios provisórios (contagem agregada ANTES do aplicativo)

- **`sem_candidatos`**: 0 registros com categoria exata associada ao nicho naquela cidade.
- **`limitada`**: 1+ registros, mas menos de 8 candidatos **OU** menos de 5 telefones com 10–13 dígitos.
- **`mais_candidatos`**: pelo menos 8 registros **E** pelo menos 5 telefones com 10–13 dígitos.

O limiar 8/5 está alinhado ao critério de suficiência de resultados do backend `enoughRelevantResults`. Essa etiqueta significa **somente quantidade preliminar**, não "cobertura boa", "contato verificado" ou "pronto para comercializar". Telefone com 10–13 dígitos é um filtro sintático fraco. O backend aplica deduplicação, ordenação, filtro de relevância e limite de 250 registros brutos, que podem reduzir a contagem. Fallback Geoapify/Google não foi avaliado nem executado. Registros de `operating_status` desconhecido não foram considerados comprovadamente abertos; foram excluídos apenas os expressamente `permanently_closed`.

## 2. Resultado nacional — versão antiga versus mapeamento preparado

| Situação | Mapeamento anterior (125 nichos) | Mapeamento preparado (164 nichos) | Diferença |
|---|---:|---:|---:|
| **Sem candidatos** | 1.082.934 | **1.079.030** | -3.904 |
| **Limitada** | 120.022 | **123.926** | +3.904 |
| **Mais candidatos (8 e 5)** | 596 | **596** | 0 |
| **Pares município×nicho avaliados** | 1.203.552 | 1.203.552 | 0 |
| Associações de registros candidatos com nichos | 199.765 | **204.056** | +4.291 |

**Distribuição do cenário preparado:** `sem_candidatos` **89,65%**, `limitada` **10,30%**, `mais_candidatos` **0,05%**. Há sobreposição entre alguns nichos (ex.: `bakery` serve Padaria e Confeitaria), portanto as 204.056 associações **não são** empresas únicas nem equivalem a 264.030 empresas úteis.

**Conclusão mais importante:** o novo mapeamento recupera **3.904 buscas município×nicho que antes tinham zero resultados**, mas **nenhuma** dessas alcançou o limiar 8/5. A melhoria amplia disponibilidade inicial e reduz resultados vazios; **não resolve profundidade do catálogo**. Não ampliar a promessa comercial por causa disso.

## 3. Nichos com mais pares acima do limiar

| Nicho | Municípios com ≥8 candidatos e ≥5 telefones plausíveis | Municípios com pelo menos 1 candidato |
|---|---:|---:|
| Hotel | 201 | 3.528 |
| Restaurante | 173 | 4.421 |
| Clínica Odontológica | 48 | 3.479 |
| Loja de Roupas | 44 | 4.452 |
| Mercado / Supermercado | 22 | 4.453 |
| Salão de Beleza | 22 | 3.919 |
| Imobiliária | 19 | 2.166 |
| Pousada | 18 | 1.090 |

Apenas **23 dos 216 nichos** possuem ao menos um município acima do limiar. **193 nichos** não possuem nenhum, embora muitos tenham algum candidato em diversas cidades. Apenas **469 dos 5.572 municípios** têm ao menos um nicho no nível `mais_candidatos` (**8,42%** dos municípios do banco). Nenhum desses indicadores demonstra leads realmente verificados, contatos ativos ou WhatsApp.

**Matriz completa:** [216 nichos × versões antiga e preparada](FASE-1-4-MATRIZ-COBERTURA-216-NICHOS.csv), uma linha por nicho/versão, com contagem de municípios vazios/limitados/com mais candidatos. Não armazenamos os 1,2 milhão de pares, apenas agregados não pessoais.

## 4. Recorte por UF

Todas as **27 UFs** apresentam pelo menos uma combinação com 8/5 na base atual, porém em pequeno número. UFs com mais combinações acima desse limiar:

| UF | Municípios do banco | Combinações `mais_candidatos` |
|---|---:|---:|
| MG | 853 | 67 |
| SP | 645 | 49 |
| CE | 184 | 47 |
| BA | 417 | 46 |
| GO | 246 | 35 |
| AL | 102 | 32 |
| RS | 499 | 29 |
| RJ | 92 | 27 |
| SC | 295 | 27 |

A comparação entre UFs **não é ranking de mercado ou qualidade**: há números distintos de municípios e diferentes limites/seleções de importação. Foco futuro deve ser nos pares cidade+nicho com resultado medido, não na UF isoladamente.

**CSV:** [Cobertura agregada nas 27 UFs](FASE-1-4-COBERTURA-27-UFS.csv).

## 5. Comparação de 18 buscas de controle

| Município | Nicho | Candidatos no novo mapeamento | Classificação |
|---|---|---:|---|
| Lavras/MG | Barbearia | 0 | Sem candidatos |
| Lavras/MG | Academia | 1 | Limitada |
| Campinas/SP | Barbearia | 3 | Limitada |
| Brasília/DF | Clínica Odontológica | 8 | Mais candidatos |
| Rio de Janeiro/RJ | Restaurante | 11 | Mais candidatos |
| São Paulo/SP | Academia | 4 | Limitada |
| Salvador/BA | Salão de Beleza | 6 | Limitada |

As 18 buscas foram classificadas com **os mapas de categorias completos das duas versões**. Neste conjunto de controle, os 18 pares não mudaram de classificação depois da Fase 1.3. O SQL antigo da Fase 1.1 utilizava categorias reduzidas em alguns casos (por exemplo, o restaurante carioca passou de 10 no antigo relatório para 11 com o mapeamento completo); **isso não é crescimento da base nem alteração de registro**.

**CSV comparativo:** [18 pares × duas versões](FASE-1-4-COBERTURA-18-CENARIOS.csv).

## 6. Onde iniciar futuros pilotos, sem prometer resultados

- **Possíveis segmentos para ensaios:** Hotel, Restaurante, Clínica Odontológica e Loja de Roupas, **somente nos municípios onde o relatório confirma maior número de candidatos**. Não recomendar "Hotel" em toda cidade; mesmo Hotel só alcança o limiar em 201/5.572 municípios.
- **Exemplos de pares com mais candidatos:** Hotel em Japaratinga/AL (28), Hotel em Aparecida/SP (27), Hotel em Luís Correia/PI (26); Restaurante em Luís Correia/PI (22). Esses são **contadores de registros de categoria exata**, não validação individual de estabelecimento nem disponibilidade real na aplicação.
- **Casos de controle negativo:** Barbearia em Lavras/MG = 0; buscar uma empresa dessa atividade ali **não deve inventar resultados** ou atribuir restaurante/bar genericamente.
- **Não considerar as 164 categorias/nichos preparados já ativados em homologação:** a Fase 1.3 alterou código no GitHub; a função Supabase `search-places` permanece sem essa publicação.

## 7. Decisão operacional para o produto

- **Não publicar selo "Cobertura alta" na UI agora.** Se exibirmos no futuro, usar rótulos transparentes como `Sem candidatos nesta base`, `Poucos candidatos nesta base` e `Mais candidatos nesta base`, sempre com quantidade e origem; a UI deve calcular sobre a busca real, não usar números congelados de 15/11.
- **Não bloquear uma busca porque o SQL antigo apontou 0:** o resultado é apenas da base Overture naquele snapshot. O catálogo pode crescer e fontes aprovadas podem ter cobertura diferente, mas não utilizá-las sem orçamento.
- **Não declarar "com WhatsApp"** com base em formato de telefone; isso requer validação própria e respeito à privacidade.
- **Priorizar relevância e não duplicação** antes de ampliar base em produção; a mediana da coleta é 60 lugares por cidade, então muitos nichos naturalmente ficam vazios.
- **Não usar o ranking de 27 UFs para prometer cobertura comercial uniforme.** Para beta, escolher **pares nicho×município** e revisar exemplares individualmente depois da Fase 0.

## 8. Reprodutibilidade e portões

- [x] Analisados 216 nichos e 5.572 municípios (1.203.552 pares).
- [x] Comparadas as classificações antes/depois (125 mapeados x 164 preparados).
- [x] Registradas métricas por nicho, por UF e 18 cenários fixos em CSV.
- [x] SQL read-only e fixture de regressão sem dados pessoais.
- [ ] Testar resultados reais autenticados com deduplicação, paginação e filtros: **bloqueado pela Fase 0**.
- [ ] Verificar relevância e titularidade dos contatos por amostra: **bloqueado pela Fase 0**.
- [ ] Implantar melhorias no Supabase (mesmo staging): **não permitido enquanto a chave exposta e segurança pendente**.

**Próxima ação segura:** **Fase 1.5a — avaliação de duplicações com SQL agregado e testes sintéticos**, sem escrita. Fase 1.5b (validação real de contatos e perfil do estabelecimento) permanecerá pendente até concluir a Fase 0. Preservar os problemas antigos de CI de migrations como bloqueadores de deploy, sem apagá-las.

**Fase 0 continua P0:** chave `service_role` de homologação anteriormente exposta sem revogação comprovada; backup real da produção e teste de restauração pendentes. Nenhuma dessas obrigações foi descartada.
