# Januário Leads — Fase 1.2: auditoria quantitativa do catálogo Overture

**Data:** 15 de novembro de 2026 (base de homologação no momento das consultas)  
**Escopo:** `public.overture_places` de `prlrxjothrslhswpkoza`, **321.179 registros**, 5.572 municípios, 27 UFs.  
**Forma:** SQL `SELECT` agregado sem acesso direto aos contatos na saída, mais leitura dos scripts V5 e `overture-search.ts`. **Não** houve escrita, chamada externa, gasto com Google/Geoapify, publicação ou acesso à produção.
**Reprodução:** [SQL somente leitura](../scripts/fase1-2-auditoria-overture-somente-leitura.sql), derivado de `overture-search.ts` SHA `88c53a6bd3dd20c079eb609f9c90904cb95d41de`.

## 1. Resultado principal — base cheia não significa lead validado

| Indicador | Contagem | Sobre todos os 321.179 |
|---|---:|---:|
| Nome em branco | 0 | 0% |
| Nome com menos de três caracteres | 29 | ~0,01% |
| Categoria ausente | 6.390 | ~1,99% |
| Endereço ausente | 24.309 | ~7,57% |
| Coordenadas ausentes | 0 | 0% |
| Coordenadas fora de caixa ampla Brasil (-35..6 lat; -75..-30 lon) | 0 | 0%; **não comprova município correto** |
| Telefone preenchido | 296.652 | ~92,36% |
| Telefone com 10 a 13 dígitos | 296.627 | ~92,35% |
| E-mail preenchido e com padrão básico | 228.277 | ~71,07% |
| Website registrado | 128.850 | ~40,12% |
| Website com formato HTTP(S) básico | 128.849 | ~40,12% |
| Instagram registrado | 42.742 | ~13,31% |
| Instagram com formato URL do domínio | 42.737 | ~13,31% |
| Instagram com caminho de postagem/exploração, não perfil | 518 | ~0,16% |
| Status de funcionamento NULL | 320.723 | ~99,86% |
| Marcado permanentemente fechado | 0 | 0%; **não prova que estão abertos** |

**Interpretação:** sintaxe de e-mail, formato do telefone e endereço WEB não comprovam operação real, titularidade, disponibilidade, WhatsApp ou Instagram oficial. Esses dados são **candidatos**, não verificados. O importador usa as listas públicas `phones/emails/websites/socials` do Overture; não cria e-mails/telefones sintéticos no código inspecionado. A origem real e atualização de cada contato individual não foram conferidas externamente nesta fase.

**WhatsApp:** o fato de um telefone conter 10–13 dígitos não prova cadastro WhatsApp. **"Sem site"** só significa "site não identificado na fonte".

## 2. Contatos compartilhados — proibição de exclusões automáticas

| Indicador | Resultado |
|---|---:|
| Telefones normalizados distintos | 284.276 |
| Grupos de telefones presentes em 2+ lugares | 9.658 |
| Registros envolvidos em telefones repetidos | 22.034 |
| Telefones presentes em 10+ lugares | 42 grupos (2.117 registros) |
| Maior número de lugares com mesmo telefone | 483 |
| E-mails distintos (caixa ignorada) | 220.137 |
| Grupos de e-mails em 2+ lugares | 7.159 |
| Registros envolvidos em e-mails repetidos | 15.299 |
| E-mails presentes em 10+ lugares | 16 grupos (624 registros) |
| Maior número de lugares com mesmo e-mail | 190 |
| Endereços de e-mail em serviços pessoais comuns (gmail/hotmail/outlook/yahoo) | 174.634 |

**Risco:** centrais telefônicas, redes e matrizes podem aparecer em várias lojas/cidades; em outros casos, o contato pode estar incorretamente atribuído. A repetição é um **sinal para revisar**, não um critério seguro para fundir ou apagar. E-mails de provedores pessoais elevam a necessidade de avaliação LGPD e não devem ser considerados, por si, e-mails institucionais.

## 3. Nomes, filiais e endereços

- **6.864 grupos** de mesmo `name_key + UF + city_key` aparecem mais de uma vez, envolvendo **13.854 registros**.
- **6.655 desses grupos** possuem mais de uma coordenada **arredondada a cinco casas**; isso não determina por si se são duplicatas ou filiais.
- **3.274 grupos** possuem mesmo `name_key + UF + city_key + endereço normalizado em minúsculas`; o grupo pode corresponder a locais diferentes em endereços genéricos. Não apagar automaticamente.
- A correção já aplicada à `search-places` mantém filiais do mesmo nome quando ficam distantes. **Teste E2E real continua pendente** por causa do bloqueio Fase 0.

**Política futura:** usar ID da fonte, nome normalizado, endereço quando específico, distância geográfica (checagem com raio de ~15m), categoria e contato; manter etiqueta `possível_duplicata` para casos ambíguos e revisão humana. Os grupos acima **se sobrepõem** aos grupos de contatos repetidos e não devem ser somados.

## 4. Cobertura real para os nichos do Buscar Leads

- Catálogo atual: **216 nichos**; **125 mapeados** explicitamente às categorias Overture.
- O código do mapeamento cita **186 códigos de categoria Overture**; na base, **150 códigos mapeados aparecem**.
- **194.343 registros (60,51%)** pertencem a alguma categoria explícita mapeada; **126.836 (39,49%)** estão fora deste conjunto. Dentre estes, existem **6.390 sem categoria**, mas também negócios de categorias ainda não mapeadas e pontos de interesse não comerciais.
- Das categorias não mapeadas, há **781 códigos distintos** presentes no banco. Um código não mapeado não é necessariamente um novo nicho válido.
- **189.409 registros** de categoria mapeada têm pelo menos um dado de contato/canal preenchido (telefone, e-mail, website ou Instagram), **não verificado**.

**Atenção:** 194.343 não significa que existam 194 mil leads elegíveis à venda: alguns podem ser duplicados, estar fechados, ter contato incorreto, estar em nichos e cidades com baixa densidade, ou não ter direito de uso adequado. Também pode haver mais de um nicho que compartilhe a mesma categoria.

## 5. Distribuição geográfica e viés do coletor

- Total **5.572 municípios**, 27 UFs.
- Mínimo **2** e máximo **260** registros por cidade; mediana **60** e média **57,64**.
- **3.374 municípios têm exatamente 60 registros**. Isso sugere influência das regras de coleta/limites por cidade; **não** uma medição de todos os estabelecimentos reais existentes.
- **83 municípios têm 10 registros ou menos**.
- O piloto anterior de 18 pares cidade+nicho apresentou apenas 0–10 registros por par; ex.: Lavras/MG + Barbearia **0**, São Paulo/SP + Academia **4**, Rio/RJ + Restaurante **10**. A ampla cobertura geográfica não representa profundidade por nicho.

## 6. Proveniência, confiança e qualidade editorial

- `data_release = 'latest'` em todos os **321.179** registros: não identifica o snapshot exato de origem nem é prova de atualização recente no Overture. Deve-se passar a registrar a **release real por importação** antes do próximo ciclo.
- A coluna `updated_at` contém o momento da escrita no Supabase (mínimo 12/11/2026, máximo 15/11/2026), não necessariamente quando o proprietário atualizou o dado de contato.
- Confiança Overture: mediana **0,850**, percentil 10 **0,376**, percentil 90 **0,991**, **50.486** abaixo de 0,5. Uma pontuação alta **não verifica telefone, e-mail ou Instagram**.
- `operating_status` não foi preenchido para 320.723 linhas: **não informar "aberto agora"** a partir da simples ausência de `permanently_closed`.
- A função `useful(row)` no script V5 usa **nome, categoria aceitável e presença de pelo menos um contato/canal plausível**, mas não verifica titularidade nem estado operacional. Os **264.030 "úteis"** são uma métrica de seleção interna, não um selo público de empresa confirmada.

## 7. Ordem objetiva de correção, sem executar mudanças agora

| Prioridade | Correção | Critério de aceite |
|---|---|---|
| P1 | Não confundir contato fornecido com verificado; manter provenance e revisão nos detalhes | UI e API mostram origem e grau de verificação corretamente |
| P1 | Revisar repetição anômala de contato, sem apagar redes/filiais | Casos de 10+ repetições sinalizados e testados com amostras seguras |
| P1 | Garantir classificação por nicho específico | 216 nichos inventariados, 125 mapeados, 91 pendentes; nenhuma categoria genérica indevida |
| P1 | Tratar Instagram não perfil (518) e links/sítios inválidos | Não anunciar postagem como "perfil oficial" |
| P1 | Registrar snapshot exato e datas de fonte no próximo importador | `data_release` versionado, nenhuma string vaga "latest" para novas cargas |
| P2 | Melhorar cobertura de municípios/nichos com quase zero resultados | Relatório por nicho/cidade e escopo do beta condizente |
| P2 | Testes com usuários reais e validação externa permitida | Somente depois de resolver a Fase 0, licenças, custos e LGPD |

## 8. Critério de conclusão desta etapa e próximo passo

**Concluído agora:** auditoria quantitativa interna integral (321.179 linhas), estatísticas de contatos/qualidade/duplicidade, mapeamento por categoria, distribuição municipal e análise do código importador; evidências reproduzíveis em SQL agregado.

**NÃO CONCLUÍDO / FORA DO ESCOPO SEGURO ATUAL:** confirmar individualmente se as empresas existem ou se cada contato é válido/oficial; revisar com pessoas reais; testes E2E autenticados na homologação enquanto a chave comprometida não for revogada; importação ou modificação de registros. Não inferir uma "taxa de empresas verificadas".

**Próxima etapa segura do Plano Mestre:** **Fase 1.3 — auditoria sistemática dos 216 nichos, 125 mapeamentos atuais e 91 pendentes**, com base nas categorias existentes e consultas agregadas, sem chamadas pagas nem alterações no banco.

**Fase 0 continua pendente**, especialmente revogação da chave `service_role` exposta e backup/restauração real da produção. A conclusão desta auditoria **não** autoriza a passagem para produção ou o beta.
