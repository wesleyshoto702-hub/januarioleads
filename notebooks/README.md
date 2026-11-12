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
- Configure **somente** a chave `service_role` do projeto staging em
  **Colab → 🔑 Segredos → OVERTURE_SUPABASE_SERVICE_ROLE_KEY** e autorize
  o acesso ao notebook. Alternativamente, a célula pede a chave com
  `getpass`, sem ecoar o valor.
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

A feature de busca Overture ainda está separada na PR #140, sem publicação
na produção; importar dados em staging não liga automaticamente o
recurso no site publicado.
