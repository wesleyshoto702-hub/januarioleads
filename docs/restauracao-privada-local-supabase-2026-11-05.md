# Restauração privada local — Januário Leads

**Estado:** auxiliar preparado; NENHUMA restauração real foi executada por esta PR.
Origem: Supabase czkazbianiflhldenhcj, PostgreSQL 17.
Esta operação depende do proprietário no Windows. Nunca suba SQL, hashes privados, senhas, tokens ou dados de clientes no GitHub/CI/ChatGPT.

## O que o auxiliar faz

O script scripts/testar-restauracao-privada-local.ps1 aceita apenas PostgreSQL em 127.0.0.1:54322, publicado na interface de loopback por uma imagem Docker supabase/postgres. Recusa um laboratório vinculado ao Supabase remoto, recusa o checkout do repositório e exige laboratório sem contas Auth nem tabelas do aplicativo.

Antes da restauração, executa o verificador de hashes e tamanhos. Em seguida aplica roles, schema e data usando psql, transação única, ON_ERROR_STOP e session_replication_role=replica, conforme o [guia oficial do Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). O script suprime a saída do SQL para evitar vazamento de dados pessoais e salva apenas o resultado do teste SQL dentro da pasta privada criptografada.

**Um resultado PASS não comprova recuperação integral:** faltam testes Auth e PostgREST com contas fictícias, contagens verificadas privadamente, Storage binário, Edge Functions, Vault, OAuth, SMTP, chaves e uma cópia independente criptografada.

## Preparação no Windows

1. Garanta criptografia do disco Windows E do armazenamento Docker Desktop/WSL2. Uma pasta em E: criptografado não garante que os volumes Docker também estejam criptografados. Use computador confiável, sem sincronização automática para nuvem.
2. Instale Docker Desktop, Supabase CLI e psql 17. Confira versões e a ajuda da CLI.
3. Prepare um laboratório **separado e descartável**, nunca vinculado ao projeto de produção. Substitua E: pelo seu volume criptografado:

~~~powershell
New-Item -ItemType Directory -Force "E:\Backups-Criptografados\laboratorio-supabase" | Out-Null
Set-Location "E:\Backups-Criptografados\laboratorio-supabase"
supabase init
docker network create -o "com.docker.network.bridge.host_binding_ipv4=127.0.0.1" januario-restore-local
supabase start --network-id januario-restore-local
~~~

Se a rede já existir, confira sua configuração antes de reutilizar. A stack deve usar PostgreSQL 17 e publicar 127.0.0.1:54322, nunca 0.0.0.0:54322. Não rode supabase link no laboratório. O script aborta quando não consegue comprovar as proteções.

4. Em OUTRO PowerShell na raiz da cópia atualizada do repositório (git pull origin main), execute usando o caminho REAL da pasta do backup exportado:

~~~powershell
.\scripts\testar-restauracao-privada-local.ps1 -PastaBackup "E:\Backups-Criptografados\Januario-Leads-Privado-..." -DiretorioSupabaseLocal "E:\Backups-Criptografados\laboratorio-supabase" -ConfirmoAmbienteDescartavel -ConfirmoArmazenamentoCriptografado
~~~

Quando pedir senha, informe apenas a senha LOCAL do PostgreSQL, jamais a de produção. Se já existe a variável PGPASSWORD, o psql irá utilizá-la; elimine qualquer variável herdada de banco remoto antes da execução.

5. Se aparecer PASS, confira o arquivo resultado-restauracao-privado.json na pasta do backup. Este relatório é **privado** e significa somente que a restauração SQL e o postcheck de policies passaram.
6. Valide Auth e PostgREST com contas fictícias, contagens agregadas sem revelar registros e dependências não incluídas no dump. Preserve pelo menos uma segunda cópia criptografada em dispositivo independente, com a senha separada.
7. Depois dos testes, encerre a stack a partir do diretório do laboratório, sem apagar o backup criptografado:

~~~powershell
Set-Location "E:\Backups-Criptografados\laboratorio-supabase"
supabase stop --no-backup
~~~

Verifique os volumes residuais do Docker: parar sem backup não equivale a apagamento criptográfico.

## Limitações e erros

- Não execute com SSH tunnel, port-forward, proxy, rede aberta, scripts não confiáveis ou containers alterados. Os guardas reduzem riscos, mas não substituem a verificação do proprietário.
- Se PostgreSQL não for versão 17, Auth não estiver inicializado ou o laboratório já contiver tabelas ou contas, use um ambiente novo. Nunca limpe produção para satisfazer o teste.
- Se o restore de roles/schema/data falhar, preserve ON_ERROR_STOP e a transação; confira compatibilidade de extensões e versões de Auth/Storage. Não elimine o tratamento de erros.
- Se os hashes falharem ou postcheck não passar, considere o backup NÃO COMPROVADO.
- Não execute supabase db push, db reset, migration repair ou SQL de DDL em produção para testar o backup.

## Bloqueios que continuam antes da PR #36

Ainda faltam exportação real, restauração SQL e funcional completa, cópia privada independente, reconciliação segura de 51 migrations remotas vs. 24 locais, preflight atualizado e aprovação explícita do proprietário para qualquer mudança de produção.

Referências oficiais: [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) e [Local Development](https://supabase.com/docs/guides/local-development/cli/getting-started).
