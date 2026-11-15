# Januário Leads — Fase 1.3: auditoria integral dos 216 nichos e ampliação conservadora do mapeamento Overture

**Data-base:** 15/11/2026. **Origem:** catálogo de nichos e `overture-search.ts` no GitHub, com contagem agregada por categoria em `public.overture_places` da HOMOLOGAÇÃO `prlrxjothrslhswpkoza`.

**Condição de segurança:** Fase 0 ADIADA, **não resolvida** (chave service_role exposta e backup de produção pendentes). Somente consultas SQL `SELECT` e alterações em arquivos de código no GitHub. **Nenhum deploy Supabase, nenhuma escrita no banco, nenhuma consulta à fonte externa, nenhuma cobrança, nenhum uso de Lovable.** Código preparado depende de teste E2E autenticado após resolução do risco.

## 1. Conclusão quantitativa

| Indicador | Antes (já em homologação) | Preparado no GitHub |
|---|---:|---:|
| Nichos visíveis no catálogo | 216 | 216 (nenhum novo item) |
| Nichos com categorias Overture explícitas | **125** | **164** |
| Nichos ainda sem mapeamento | 91 | **52** |
| Nichos com mapeamento mas sem registros na base | 9 | **1** (Construtora) |
| Códigos de categoria Overture associados | **187** | **246** |
| Registros de categorias associadas, Brasil | **194.629** | **198.920** |
| Acréscimo potencial com categorias já existentes | — | **4.291 registros** |

**Nota importante:** números de categorias são deduplicados. Nichos podem compartilhar a mesma categoria (ex.: `bakery` para Confeitaria/Padaria; `dessert_shop` para Confeitaria/Doceria; `car_wash` para Lava-Rápido/Estética Automotiva). Somar contagens por nicho pode contar uma empresa mais de uma vez; somar categorias distintas não. Além disso, as contagens são nacionais, não por município, e não validam existência real, telefone ativo, e-mail correto, WhatsApp, Instagram oficial ou direitos de uso.

O novo bloco `OVERTURE_CATEGORY_PHASE13` tem **51 entradas de nichos e 59 códigos específicos ainda não mapeados**: 39 nichos antes sem categoria, 8 nichos com categoria antiga ausente, 4 nichos já mapeados que ganharam especializações. Foi incluído no cálculo de `categoriesForOverture`, sem alterar labels, UI, CRM, Colab nem configurações de provedores.

### Por que os números anteriores de 1.2 eram ligeiramente diferentes?

A auditoria anterior tinha contado **186 categorias e 194.343 registros** porque um extrator por regex ignorou a categoria contendo o dígito `2`, `b2b_advertising_and_marketing_service`. Ela já existia no código e contém **286 registros**, dos quais 274 com pelo menos um contato preenchido. Portanto, a base **antes** da Fase 1.3 tinha **187 categorias/194.629 registros**. O relatório histórico e o SQL reproduzível da Fase 1.2 foram corrigidos, sem atribuir estes 286 registros à expansão da Fase 1.3.

## 2. Análise por grupo — 16 grupos, 216 nichos

| Grupo | Total | Antes | Preparado | Ainda sem mapeamento |
|---|---:|---:|---:|---:|
| Alimentação | 21 | 15 | 16 | 5 |
| Beleza e estética | 14 | 6 | 10 | 4 |
| Saúde | 23 | 10 | 22 | 1 |
| Serviços residenciais | 20 | 11 | 15 | 5 |
| Construção e reformas | 12 | 5 | 5 | 7 |
| Casa e decoração | 7 | 1 | 2 | 5 |
| Automotivo | 16 | 13 | 16 | 0 |
| Educação e esportes | 16 | 10 | 12 | 4 |
| Eventos | 9 | 2 | 4 | 5 |
| Turismo e hospedagem | 11 | 7 | 8 | 3 |
| Serviços profissionais | 12 | 8 | 10 | 2 |
| Serviços empresariais | 12 | 4 | 7 | 5 |
| Comércio | 28 | 28 | 28 | 0 |
| Pets | 7 | 3 | 6 | 1 |
| Agronegócio | 5 | 1 | 2 | 3 |
| Logística | 3 | 1 | 1 | 2 |
| **Total** | **216** | **125** | **164** | **52** |

**Matriz completa e verificável:** [CSV com os 216 nichos, categorias antigas/adicionadas, contagens nacionais e status individual](FASE-1-3-MATRIZ-COMPLETA-216-NICHOS.csv).

## 3. Exemplos de oportunidades recuperadas com dados existentes

| Nicho | Categoria específica encontrada no staging | Registros candidatos disponíveis no Brasil |
|---|---|---:|
| Adega | `liquor_store` | 487 |
| Maquiagem Profissional | `makeup_artist` | 279 |
| Cartório / Serviços Notariais | `notary_public` | 271 |
| Curso Profissionalizante | `vocational_and_technical_school` | 234 |
| Chaveiro | `key_and_locksmith` | 139 |
| Reforço Escolar | `tutoring_service` | 120 |
| Montador de Móveis | `furniture_assembly` | 94 |
| Ginecologista | `obstetrics_and_gynecology` | 86 |
| Lavanderia | `laundromat` + `dry_cleaning` | 198 |
| Locadora de Veículos | `car_rental_service` | 51 |
| Depilação a Laser | `laser_hair_removal` | 60 |
| Guincho | `towing_service` | 59 |
| Cardiologista | `cardiology` | 48 |
| Fonoaudiólogo | `speech_therapy` | 30 |
| Psiquiatra | `psychiatry` | 12 |

Os números são **candidatos já armazenados**, não novas empresas importadas. Uma categoria pode ser apropriada para um nicho e ainda assim a ficha individual estar incorreta, desatualizada, ou não disponível em determinada cidade.

## 4. O que NÃO foi mapeado e por quê

**52 nichos ainda estão sem categoria exata segura**, distribuídos principalmente em Construção e reformas (7), Alimentação (5), Serviços residenciais (5), Casa e decoração (5), Eventos (5), Serviços empresariais (5) e outros grupos. Exemplos: Açaiteria, Marmitaria, Móveis Planejados, Desentupidora, Serviços de TI para Empresas, Creche para Cães e Motoboy / Entregas.

**Não usar categorias amplas somente para fabricar resultados.** Rejeitadas nesta etapa: `school` (5.519 registros), `shopping` (4.937), `professional_service` (3.963), `party_and_event_planning` (2.732), `it_service_and_computer_repair` (1.330), `travel_service` (795), `animal_or_pet_service` (442), `building_or_construction_service` (809), `lodging` (1.083), entre outras. Elas são ambíguas ou muito abrangentes para um nicho específico: `school` não é automaticamente Escola de Robótica, `animal_or_pet_service` não é necessariamente Creche para Cães, etc.

**1 nicho possui categorias mapeadas, mas continua sem registro correspondente:** Construtora (`construction_company`). Isto deve ser exibido como cobertura indisponível em vez de substituir a categoria por algo genérico.

Códigos mais vagos e candidatos de significado ambíguo devem permanecer para revisão de taxonomia/qualidade editorial. Não usar classificação de palavras do nome ou Instagram como prova, pois pode gerar falsos positivos.

## 5. Verificações para aprovação antes do deploy

- [x] 216 nichos sem duplicações no catálogo; todos inventariados no CSV.
- [x] 51 mapeamentos analisados, 59 categorias específicas novas, cada código observado com pelo menos 1 registro na HOMOLOGAÇÃO.
- [x] Contagem nacional de categorias únicas antes/depois reprodutível com fixture agregada: 194.629 → 198.920.
- [x] Não alterar a lista de escolhas do usuário, IDs, dados nem produzir deduplicação agressiva.
- [x] Preparar testes offline de não regressão para o mapeamento existente e casos sem correspondência.
- [ ] Testar chamadas reais de `search-places` com login de homologação em cidades/nichos distintos, incluindo novos nichos e casos de cobertura zero — **bloqueado pela Fase 0**.
- [ ] Revisar licença/atribuição e campos de dados antes de uso público.
- [ ] Medir relevância editorial e falsos positivos com amostra independente, sem expor dados pessoais — **bloqueado para publicação pela Fase 0**.
- [ ] Publicar nova função exclusivamente no STAGING após resolver chave comprometida, verificar backups/rollback, CI e critérios de liberação. **Não publicar em produção** como consequência deste PR.

## 6. Próxima ação única no Plano Mestre

**Fase 1.4 — classificar cobertura por UF/cidade/nicho** com o mapeamento preparado, sem prometer disponibilidade uniforme. Usar SQL somente leitura e dados agregados para marcar `sem resultados`, `cobertura limitada` e `cobertura com mais resultados`; o indicador deve identificar que se trata de registros candidatos da base, não empresas verificadas. O teste real da integração fica pendente até a resolução de Fase 0.

**Lembrete P0:** antigo `service_role` exposto ainda exige revogação comprovada; backup/restauração efetivos da produção permanecem pendentes. O roadmap só permite avançar em tarefas read-only e testes offline até resolver essas pendências.
