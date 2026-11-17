# Overture no Januário Leads — estado seguro em 17/11/2026

## IMPORTAÇÕES SUSPENSAS DURANTE A FASE 0

**Não execute nenhum notebook antigo de importação**: as versões históricas V4–V6.2 e os pilotos originais podem solicitar ou aceitar a antiga JWT `service_role`, previamente exposta. Seus links e commits fixos são preservados apenas como referência histórica e NÃO devem ser usados para novas execuções.

O notebook atual de referência é a [V6.3 Sessão Estendida](Januario_Leads_Fase_9_V6_3_Sessao_Estendida.ipynb), cujo início recusa credenciais JWT legadas e aceita apenas `sb_secret_` moderna do projeto **HOMOLOGAÇÃO** `prlrxjothrslhswpkoza`. Mesmo a V6.3 só deve ser retomada após a revogação e os testes da Fase 0.1, e após o backup/restauração da produção na Fase 0.2.

O progresso atual é persistido no Supabase staging, e não depende da sessão do Colab. Não copie chaves secretas para repositórios, notebooks compartilhados, capturas de tela ou conversas. Não use chaves de produção.

Ver o [plano mestre](../docs/PLANO-MESTRE-JANUARIO-LEADS.md) e o [registro da Fase 0](../docs/FASE-0-SEGURANCA-BACKUP-2026-11-15.md).

---

## Documentação histórica do piloto (NÃO EXECUTAR)

# Importar Overture sem GitHub Actions — gratuito com Google Colab

## Abrir

Após este arquivo entrar na branch `main`, use:
[**Abrir notebook no Google Colab**](https://colab.research.google.com/github/wesleyshoto702-hub/januarioleads/blob/main/notebooks/overture_piloto_colab.ipynb).

É possível executar pelo navegador, inclusive no celular (a interface de notebook
é mais confortável no computador). Requer conta Google e disponibilidade de
recursos gratuitos do Colab. **Não** requer GitHub Actions, Colab Pro ou
Vercel. Ver FAQ do Colab: https://research.google.com/colaboratory/intl/pt-BR/faq.html

## Segurança

- Este piloto usa **exclusivamente Supabase STAGING** `prlrxjothrslhswpkoza`.
- Não use nem copie a chave da produção.
- **Instrução histórica revogada:** não utilizar a antiga chave `service_role`, nem os Segredos do Colab usados no piloto. Para novas importações, usar apenas a V6.3 e a credencial `sb_secret_` moderna em canal protegido, após liberar a Fase 0.
- **Não** escreva a chave na célula de código, no chat, no GitHub nem em
  arquivos compartilhados. Feche a sessão de execução após importar.
- Cada importação fica limitada a **um município**, até **30 estabelecimentos**,
  com teto de **100 MiB de armazenamento** do banco de dados.
- O script importador é baixado de um commit fixo auditado do projeto
  (`53771f80e0acebd8060afd881ac16e10e85a4a97`), não da última versão
  aleatória de um repositório.
- Começar por **Varginha/MG**; conferir o relatório antes de mudar para
  **Pouso Alegre/MG → Campinas/SP → Niterói/RJ**.
- Se o Colab ficar indisponível ou interromper a sessão, use o mesmo importador
  num **computador com Ubuntu/WSL**, instalado e executado manualmente.

## O que esperar

Este notebook **não roda sozinho em segundo plano**. O operador precisa
abrir, autorizar a chave temporária e executar as células.
A modalidade gratuita do Colab tem limites variáveis; a importação pode
ser interrompida mesmo sem atingir o teto do banco. Se isso ocorrer,
verifique o status e retome com um único município depois.

Dados Overture e IBGE são públicos, mas acesso aos seus servidores precisa
estar disponível no ambiente Colab. A importação real só está confirmada
quando o Supabase mostrar as novas linhas.

Observação histórica: a situação da PR #140 já não representa o estado atual do projeto. Consulte o Plano Mestre acima.
