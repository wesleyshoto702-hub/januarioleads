# Backup privado do Januário Leads no Supabase Free

**Projeto de produção:** `czkazbianiflhldenhcj`  
**Data da análise:** 05/11/2026  
**Status:** exportação e verificação de integridade preparadas. **Não há backup restaurável comprovado.**

## O que foi confirmado

A organização Supabase conectada ao Januário Leads está no plano
**Free** (`tier_free`). O projeto está `ACTIVE_HEALTHY`, em
PostgreSQL 17. O Free não recebe backups diários automáticos, conforme
a documentação oficial do Supabase. Também não existe segundo projeto
Supabase Cloud ou branch de homologação conectado.

O conector disponível nesta auditoria **não oferece exportação privada
de banco nem acesso para comprovar a restauração**, e por isso não
foram extraídos `auth.users`, leads, pagamentos, segredos ou dados de
clientes. Não é seguro criar uma exportação de produção em GitHub
Actions ou transferi-la pelo chat.

**A próxima ação depende do proprietário executar uma exportação
no computador pessoal**, protegendo-a em volume criptografado.
Isso mantém os custos de hospedagem do Supabase no plano Free.

## Preparação no Windows

1. Instale a Supabase CLI e o Docker Desktop. Confirme com
   `supabase --version`, `supabase db dump --help` e
   `docker version`. Nunca use `db reset`, `db push`,
   `migration repair` ou `migration fetch` para fazer backup.
2. Crie ou desbloqueie **um volume criptografado** (por exemplo,
   BitLocker ou VeraCrypt). Use uma pasta fora do GitHub, fora do
   Google Drive/OneDrive em sincronização automática não autorizada
   e fora do código-fonte. Uma pasta comum no disco sem criptografia
   **não** satisfaz o requisito.
3. Faça uma cópia local do repositório e abra o PowerShell na raiz.
   Autentique-se **no próprio terminal**, sem colar senha nem token
   em conversas:

   ```powershell
   supabase login
   supabase link --project-ref czkazbianiflhldenhcj
   ```

   Confirme que o projeto exibido é o Januário Leads e não outro.
   O vínculo é local, não atualiza dados nem migrations.
4. Execute o auxiliar **somente depois de confirmar o volume
   criptografado**. Substitua a pasta de exemplo pela sua pasta
   criptografada real:

   ```powershell
   .\scripts\exportar-backup-privado.ps1 -Destino "E:\Backups-Criptografados" -ConfirmoVolumeCriptografado
   ```

   O auxiliar identifica a versão da Supabase CLI: na **v2** usa
   `--linked` e na **v3** usa `--remote=czkazbianiflhldenhcj`
   em cada exportação, fixando o projeto de destino. A v3
   tornou comandos de banco locais por padrão em novembro de 2026;
   executar `db dump` sem indicar explicitamente o alvo pode gerar
   uma cópia do banco **errado**. Versões principais fora de 2 e 3
   são recusadas até revisão. Consulte a [migração oficial da CLI v3](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3).

   O arquivo `scripts/exportar-backup-privado.ps1` recusa a execução
   se o projeto vinculado não corresponder a
   `czkazbianiflhldenhcj`, se o destino estiver dentro do
   repositório, se a confirmação do armazenamento criptografado
   não for dada ou se a CLI/Docker não estiverem disponíveis.
   Ele **não verifica automaticamente se o volume está criptografado**:
   essa condição deve ser conferida pelo proprietário.
5. A CLI executa três operações de **exportação, sem escrita no
   banco remoto** (o script troca `ALVO` por `--linked` na v2 ou
   `--remote=czkazbianiflhldenhcj` na v3):

   - `supabase db dump ALVO --role-only --file ...`
   - `supabase db dump ALVO --file ...`
   - `supabase db dump ALVO --data-only --use-copy --file ... -x storage.buckets_vectors -x storage.vector_indexes`

   As exclusões vetoriais seguem o roteiro oficial de backup/restore:
   são tabelas internas de Storage, não objetos binários de clientes.

   Os arquivos locais `roles.sql`, `schema.sql` e `data.sql`
   podem conter **informações pessoais, segredos de aplicação ou
   metadados sensíveis**; jamais anexe ou sincronize o conteúdo com
   GitHub, chats ou ferramentas de IA.
6. O auxiliar salva `manifesto-privado.json` junto aos SQLs,
   informando tamanhos e SHA-256. Se ocorrer falha, remove a pasta
   parcial recém-criada. Esse manifesto **não valida a restauração**.

   Antes de restaurar, confira **localmente** os tamanhos e hashes
   sem enviar o conteúdo a ninguém, substituindo o caminho pela
   pasta criada pelo exportador:

   ```powershell
   .\\scripts\\verificar-integridade-backup-privado.ps1 -PastaBackup "E:\\Backups-Criptografados\\Januario-Leads-Privado-..."
   ```

   A verificação devolve `PASS` apenas se os três SQLs corresponderem
   aos SHA-256 e tamanhos declarados. Isso detecta corrupção acidental,
   mas **não garante autenticidade do manifesto**, nem é uma prova de
   restauração bem-sucedida.

   Faça pelo menos uma **segunda cópia criptografada** em outra
   mídia/local seguro, sem armazenar a senha junto do backup.

Caso o Windows bloqueie scripts PowerShell, revise suas políticas
locais de execução em vez de desativar proteções automaticamente.
O script pode ser inspecionado antes de ser executado; nunca copie
uma URL PostgreSQL com senha para os argumentos de comando.

## Conferência de restauração, sem arriscar produção

**Critério obrigatório:** um dump que nunca foi restaurado é apenas
uma exportação, não um backup recuperável comprovado.

- Preparar um ambiente Supabase **local/efêmero e vazio**, sem
  configurações que apontem para `czkazbianiflhldenhcj`.
  Usar Docker Desktop e banco de dados compatível com PostgreSQL 17;
  nunca indicar host remoto do projeto real.
- Seguir o procedimento oficial de
  [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):
  exportar roles/schema/data separadamente e restaurá-los com
  `psql --single-transaction --variable ON_ERROR_STOP=1`, somente
  para uma **conexão local** verificada. Ao usar `psql` para
  restaurar o dump de dados, seguir exatamente as precauções do
  guia quanto a `session_replication_role`, permissões e diferenças
  de versões dos serviços Supabase.
- Em um ambiente local de homologação, comparar contagens de tabelas,
  chaves, colunas, funções, RLS, a existência de usuários em
  `auth.users`, os relacionamentos e as contagens agregadas de
  tabelas críticas. **Não imprimir registros ou e-mails** nos logs
  ou no chat; somente metadados agregados.
- Validar login e consultas de contas fictícias antes de declarar
  a restauração completa. Um backup de banco **não inclui os objetos
  binários de Storage**, as chaves privadas, configs OAuth, Edge
  Functions ou segredos — esses exigem procedimentos independentes.
- Registre **local e privadamente**: nome do backup, data, hashes
  SHA-256, ferramenta/versão usada, resultado da restauração,
  limitações observadas e local da cópia adicional.
- **Não executar a restauração neste projeto de produção**.
  Não carregar um backup com contas de clientes em um projeto
  hospedado com acesso público. Destruir de forma segura a
  instância local após os testes.

**Atenção ao projeto:** o diretório `supabase/migrations/` continua
com 24 arquivos locais, enquanto o ledger real registra 51
versões. Um restore de dados não autoriza `db push`, `db reset`
vinculado ao remoto ou `migration repair`. A reconciliação do
histórico operacional ainda é um bloqueio separado.

## Situação dos requisitos antes da correção RLS (PR #36)

| Requisito | Estado em 05/11/2026 |
| --- | --- |
| Supabase Free confirmado | **Sim** |
| Backups automáticos diários nesse plano | **Não incluídos** |
| Auxiliar local de exportação e verificador de integridade preparados | **Sim** |
| Exportação real dos dados de produção | **Não executada** |
| SHA-256 de backup privado real | **Não disponível** |
| Restore de backup privado real comprovado | **Pendente** |
| Políticas RLS e ledger preflight read-only | **PASS (em 05/11/2026)** |
| Homologação GoTrue + PostgREST fictícia | **PASS** |
| Autorização para DDL de produção | **Não concedida** |

**Regra:** não aplicar o SQL da PR #36 em produção até que
um backup restaurável esteja comprovado, o mecanismo de deployment
sem reexecutar históricos esteja revisado e haja autorização
específica para a alteração.

## Referências

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/supabase-db-dump
- `docs/rls-release-readiness-2026-11-05.md`
- `docs/reconciliacao-migrations-supabase-2026-11-05.md`
