# Januário Leads — Fase 9 V5: expansão orientada a 600 mil empresas úteis

**Status:** infraestrutura implementada em **HOMOLOGAÇÃO**, pronta para execução manual no Colab, sem executar downloads pagos nem alterar a produção.

## Diagnóstico antes de iniciar a V5

Dados observados em 14/11/2026, projeto de homologação `prlrxjothrslhswpkoza`:

| Métrica | Valor |
|---|---:|
| Registros Overture armazenados | 291.515 |
| Registros preliminarmente úteis (nome, categoria comercial, algum contato) | 234.129 |
| Municípios distintos | 5.572 |
| Tabela Overture com índices | 150,5 MiB |
| Banco total | ~164,6 MiB |
| Municípios sem barbearia registrada | 3.095 |
| Municípios sem academia/fitness registrado | 2.574 |
| Municípios sem serviço automotivo registrado | 2.119 |
| Municípios sem hospedagem registrada | 1.956 |
| Municípios sem beleza registrada | 1.679 |

Essas contagens são **lacunas da base importada**; não são contagens de estabelecimentos inexistentes na realidade. O critério de empresa útil é preliminar e não verifica telefone, e-mail ou redes sociais ao vivo.

## Estratégia

Usar a **referência populacional de 2022, compilada a partir de estimativas demográficas e versionada no próprio GitHub do Januário Leads**, sem chamar a API do IBGE a cada execução. Ela orienta somente o porte e a cota de cada município (não deve ser confundida com os números finais do Censo 2022). Fonte: [compilação populacional](https://github.com/lsbastos/popBR_mun/blob/master/poptcu2010-2022_2024.csv). O planejamento considera:

| Município | População de referência | Meta por cidade |
|---|---|---:|
| Pequeno | Até 29.999 habitantes | Até 100 |
| Médio | 30.000 a 149.999 | Até 240 |
| Grande | 150.000 a 699.999 | Até 700 |
| Metrópole | 700.000 ou mais | Até 2.400 |
| População ainda não conciliada com o IBGE | desconhecida | Até 100 (conservador) |

**As metas são tetos, não cotas obrigatórias:** se o Overture não possuir estabelecimentos válidos suficientes, nenhum dado inventado será inserido. O algoritmo favorece categorias ausentes e nichos pouco presentes no município e prefere empresas com telefone, email, site próprio ou Instagram.

A V5 permite repetir a cidade em sessões posteriores, importando **até 40 novos registros úteis por download**, enquanto não atingir a meta municipal. A proteção vitalícia +40 da V4 **não se aplica à V5**, mas os dados da V4 não são excluídos nem reprocessados automaticamente.

## Limites e custos

- **600.000 registros preliminarmente úteis** é a meta nacional; o total bruto pode passar de 600.000 por causa dos registros históricos incompletos e de POIs.
- **340 MiB** para tabela Overture incluindo índices (limite rígido de parada).
- **440 MiB** para o banco inteiro (limite rígido de parada); preserva ~36,8 MiB antes da franquia Free de 500 MB decimais.
- Cada inserção consulta o consumo real, com margem conservadora de 1 KiB por nova empresa. Isso evita planejar somente pela média histórica.
- **1 a 3 municípios próximos por download**, distância máxima operacional de 25 km entre centros; verificação adicional da caixa geográfica pelos polígonos oficiais do IBGE.
- **90 segundos** entre inícios de downloads, com variação aleatória; **8 horas** de bloqueio global após limite de requisições 429, considerando checkpoints da V4 e V5.
- **Até 120 downloads** por sessão (limite de tempo de 9h); cada sessão precisa ser iniciada pelo usuário.
- **Geoapify e Google Places não são usados pela rotina de importação.** Continuam disponíveis como complementos na busca do SaaS, com os limites gratuitos já configurados.

Os limites de armazenamento **podem impedir a meta de 600 mil úteis**, particularmente porque nem todos os registros antigos são aproveitáveis e porque novos registros mais completos podem ocupar mais bytes do que a média. Não elevar os limites nem excluir registros automaticamente para forçar uma meta numérica.

## Como executar

1. Abra o [notebook Fase 9 V5](https://colab.research.google.com/github/wesleyshoto702-hub/januarioleads/blob/main/notebooks/Januario_Leads_Fase_9_V5_600_Mil_Empresas.ipynb).
2. Execute as três primeiras células em ordem (dependências, importadores públicos, referência populacional 2022 armazenada no GitHub e validações locais). **A célula 2 não consulta mais a API do IBGE e evita o timeout relatado.** Sem credenciais e sem importações.
3. Na última célula, confirme **`AMPLIAR_600K`** e informe **somente** a chave secreta de **HOMOLOGAÇÃO**, no campo oculto. **Nunca cole essa chave no chat.**
4. O notebook lista grupos de cidades priorizados, aplica cotas, consulta o Overture e grava apenas as empresas inéditas aproveitáveis. Caso encontre 429, interrompe e registra o período de segurança.
5. Ao final, confira o relatório: `total_companies`, `useful_companies`, `overture_mib`, `database_mib`, `added`, `errors`. Depois desconecte o runtime do Colab.

**Arquivos importantes:** `scripts/expand_overture_600k_staging.py`, `tests/test_overture_v5_offline.py`, migrations `2026111409*`, `.github/workflows/validar-fase-9-v5-600k.yml`.

A V4 antiga continua preservada como histórico; para ampliação orientada a nichos **use a V5**, não rode V4 e V5 simultaneamente. A produção `czkazbianiflhldenhcj` permanece inalterada.

## Correção para TimeoutError/URLError na célula 2 (14/11/2026)

O Colab estava tentando conectar diretamente a `servicodados.ibge.gov.br/api/v1/localidades/municipios` com timeout de 55 segundos. Uma falha de conexão encerrava a configuração **antes de solicitar qualquer chave**. A célula agora lê `data/populacao-municipal-2022-referencia.json` diretamente do GitHub do projeto (a mesma origem dos scripts). Se a conexão com o GitHub falhar, faz uma nova tentativa curta e interrompe com mensagem clara, **sem executar importações** nem pedir credenciais. Reabra o notebook pela URL principal, execute novamente desde o início e não use a aba antiga que está com o código em cache.
