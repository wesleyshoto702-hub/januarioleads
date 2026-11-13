# Januário Leads — Overture automático (SOMENTE HOMOLOGAÇÃO)

## Estado atual

O Colab continua existindo, mas a execução automática é feita pelo **GitHub Actions**.
Essa automação foi criada **desligada por padrão**, até você habilitar a variável de controle.

- Workflow: [import-overture-staging-automatico.yml](../.github/workflows/import-overture-staging-automatico.yml)
- Importador: [import_overture_staging_auto.py](../scripts/import_overture_staging_auto.py)
- Destino fixo: `https://prlrxjothrslhswpkoza.supabase.co` (STAGING).
- Agendamento: **a cada 2 horas, às :23 UTC** (12 tentativas diárias; horários em Brasília variam com a conversão UTC-3); o GitHub pode atrasar horários.
- Limite: **3 municípios por rodada, até 60 empresas por cidade (até 36 municípios/dia, quando todas as execuções completam)**; a seleção pula todos os municípios já cadastrados.
- Armazenamento: cancela novos municípios a partir de **88 MiB**; o importador tem limite próprio de **90 MiB**.
- Lotes não se sobrepõem com a workflow de piloto no GitHub, por `concurrency`.
- Falhas de municípios são adiadas por 3 dias (tabela privada `overture_auto_city_attempts`); não ficam bloqueando a fila.

**Ritmo:** 12 execuções previstas por dia × 3 municípios por execução = **até 36 municípios/dia**. É uma capacidade teórica: falhas, atrasos do GitHub, duração do runner, limite de armazenamento e ausência de estabelecimentos podem reduzir o total. Não são 36 municípios garantidos.

## Habilitação única (obrigatória)

Não envie sua chave no chat nem a salve em arquivos do repositório.

1. No painel Supabase, abra **Januário Leads — Staging**. Copie uma **chave secreta** do projeto (preferencialmente `sb_secret_...`; também aceita chave legada JWT `service_role`).
2. No [GitHub → Settings → Environments](https://github.com/wesleyshoto702-hub/januarioleads/settings/environments), abra (ou crie) o ambiente com o nome exato **`homologacao`**. Adicione um **Environment secret** chamado exatamente **`OVERTURE_SUPABASE_SERVICE_ROLE_KEY`** com a chave da **homologação**. Não use a chave de produção.
3. Na aba [Actions](https://github.com/wesleyshoto702-hub/januarioleads/actions), abra **Overture Brasil - importacao automatica - STAGING**. Clique **Run workflow** para **testar manualmente uma vez**. Confira se surgem linhas `CONFIRMADO NO SUPABASE`; **não habilite a agenda se houver falha**.
4. Para ligar a agenda, abra [Settings → Secrets and variables → Actions → Variables](https://github.com/wesleyshoto702-hub/januarioleads/settings/variables/actions). Crie a variável do repositório **`OVERTURE_AUTO_ENABLED` = `true`**.
5. Depois disso, o agendamento executa sem você abrir o Colab. Para parar, altere a variável para **`false`**.

## Segurança

- Nunca insere dados na produção nem usa Vercel.
- Não há segredo no código; a chave fica no cofre do GitHub Actions (ambiente `homologacao`).
- Um erro de chave faz o processo parar sem revelar o segredo.
- A tabela `public.overture_auto_city_attempts` tem RLS ligado e permissões negadas a `anon`/`authenticated`; somente `service_role` pode usá-la.
- A importação é idempotente pelo ID de origem; as cidades com dados já existentes não são reimportadas.
- O GitHub Actions usa `ubuntu-latest` e o repositório é público. As regras de preço, duração máxima, limites de rede e uso justo do GitHub podem mudar. A agenda não garante execução pontual nem cobertura integral de municípios.
- A versão atual prioriza **uma amostra de até 60 empresas por município**, não todas as empresas brasileiras. A verificação da oficialidade do Instagram e da atividade comercial ainda é necessária.
- Se você continuar executando Colab simultaneamente com o agendamento, pode haver importações concorrentes. Recomenda-se pausar o Colab após ativar o processo automático.

## Monitoramento

Veja as execuções e erros em: https://github.com/wesleyshoto702-hub/januarioleads/actions/workflows/import-overture-staging-automatico.yml

Confira registros no relatório: https://supabase.com/dashboard/project/prlrxjothrslhswpkoza/explorer/notebook/bf4cdc31-e882-4854-9dbb-216eafc8d52b

Se não houver segredo ou se a variável não estiver habilitada, **a rotina não importará automaticamente**. Configurar a variável não substitui o teste manual da etapa 3.
