# Fase 0.2 — Backup privado, Storage e recuperação isolada da PRODUÇÃO

**Data de abertura:** 17/11/2026 • **Estado:** EM EXECUÇÃO — inventário e testes de segurança preparados; **backup real e restauração NÃO executados**.

**Alvo ÚNICO de leitura:** `czkazbianiflhldenhcj` (PRODUÇÃO).  
**Projeto de homologação:** `prlrxjothrslhswpkoza` (não usar nesta fase).

## Resumo do inventário (consulta real de leitura de 17/11/2026 ~18h23 BRT)

| Recurso | Contagem / bytes |
|---|---:|
| PostgreSQL (`pg_database_size`) | **22.850.707 bytes = 22,85 MB** |
| Leads `public.leads` | **212** |
| Atividades `public.lead_activities` | **259** |
| Auth `auth.users` | **2** |
| Auth `auth.identities` | **3** |
| Tabelas públicas de base | **20** |
| Storage buckets | **1**, privado: `prompt-visual-references` |
| Storage objetos | **9**, somando **760.690 bytes** conforme metadados |
| Extensões | `pg_cron`, `pg_net`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp` |

Esses números compõem a linha de base de conferência, **não** um backup. A contagem pode variar com uso real do SaaS; divergências precisam ser explicadas antes de aprovar a restauração.

## 0.2A — Inventário e preparação: FEITO

- [x] Consultas `SELECT` remotas a PROD sem copiar registros de clientes para o GitHub.
- [x] [Script de pg_dump cifrado](../scripts/fase0-backup-producao.ps1): protege destino de Git, exige reconhecimento de volume criptografado, cria arquivos temporários nesse mesmo volume, cifrando com GPG AES256, verifica integridade do arquivo GPG e índice do `pg_restore`. Não altera a produção.
- [x] [Script privado de Storage](../scripts/fase0-backup-storage-producao.py): acesso read-only com `sb_secret_` da **PRODUÇÃO**, digitada localmente via `getpass` (não enviar para GitHub/chat), destino fora do Git em volume criptografado, 9 objetos/760.690 bytes esperados, manifestos com SHA256, falha se arquivos não conferem.
- [x] CI automático sem acesso a dados reais: [workflow `fase0-validar-backup.yml`](../.github/workflows/fase0-validar-backup.yml) executa testes sintéticos de import/export e análise sintática do PowerShell; código do Storage **não foi exercitado contra a API real**.
- [x] `.gitignore` ampliado para reduzir o risco de adicionar dumps de clientes por acidente. Isto **não substitui** a regra de manter backup fora do repositório.

## 0.2B — Backup físico privado: REALIZADO SEGUNDO LOG DO PROPRIETÁRIO (RESTORE PENDENTE)

### Pré-requisitos no PC Windows confiável

1. Uma pasta **fora** do repositório num volume **criptografado** (BitLocker ou equivalente, comprovado pelo proprietário), com acesso restrito e espaço livre; a criptografia do GPG não elimina os intermediários em texto claro durante a exportação.
2. Cliente PostgreSQL com `pg_dump` e `pg_restore`; **GnuPG / `gpg`** no PATH.
3. Pasta local do repositório Git atualizada (`git pull`). Não armazenar senhas em scripts, arquivos `.env` ou logs. Não enviar dumps, nomes dos arquivos privados ou manifests de clientes para ChatGPT/GitHub.

### Comandos (PowerShell, raiz do repositório)

Primeiro validar o ambiente, **sem conexão**:

```powershell
powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Check
```

Após confirmar pessoalmente que o destino é um volume criptografado, executar. **Ajustar o caminho `E:\Backups-Criptografados` para um volume real protegido.**

```powershell
powershell -NoProfile -File scripts/fase0-backup-producao.ps1 -Mode Backup -OutputDirectory "E:\Backups-Criptografados" -ConfirmoVolumeCriptografado
```

O script exige host e usuário PostgreSQL de **PRODUÇÃO** obtidos em [Supabase > Connect](https://supabase.com/dashboard/project/czkazbianiflhldenhcj) (Session Pooler 5432 ou conexão direta); digitar `BACKUP_PRODUCAO`. A senha PostgreSQL é solicitada via prompt oculto, **não** é a chave `sb_secret_`. O GPG solicita outra senha de cifragem, que deve ser guardada num gerenciador separado.

**Saída esperada:** `januario-prod-<UTC>.dump.gpg` e `januario-prod-<UTC>-manifest.json` com hash SHA-256 e `isolated_database_restore_verified=false`. A conferência de `pg_restore --list` não valida restauração.

### Atenção à portabilidade entre bancos

O `pg_dump` bruto gera um snapshot coerente dos schemas `public/auth/storage`, mas **não cobre roles globais, segredos de funções, configuração Auth, conteúdo de objetos Storage e recursos gerenciados do Supabase**. A restauração direta desse dump em Postgres simples pode falhar por dependências/ownership/extensões/roles especiais, conforme [guia oficial de migração](https://supabase.com/docs/guides/self-hosting/restore-from-platform).

Para restauração completa ou migração, complementar com [`supabase db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump) de **roles/schema/data**, observando que o comando padrão **exclui schemas gerenciados `auth` e `storage`**. O [script alternativo `exportar-backup-privado.ps1`](../scripts/exportar-backup-privado.ps1) já gera roles/schema/data via Supabase CLI em volume protegido, mas **não substitui** a cópia de bytes dos objetos, nem garante por si só uma restauração completa de Auth/Storage. Execute apenas após revisar a versão local da CLI e executar `supabase db dump --help`.

## 17/11/2026 — Evidência de execução real do backup PostgreSQL

O proprietário apresentou log da execução local em Windows, realizada em **17/11/2026 às 22:59:54 UTC**:
- Script `scripts/fase0-backup-producao.ps1 -Mode Backup -ConfirmoVolumeCriptografado`, apontando exclusivamente ao ref de **PRODUÇÃO** `czkazbianiflhldenhcj`, Session Pooler `:5432`;
- `pg_dump` concluiu a exportação de dados e estruturas dos schemas `public`, `auth`, `storage`, conforme saída do cliente;
- `gpg` reportou cifragem simétrica AES256 e decifração; o script concluiu `pg_restore --list` sem erro;
- Arquivo gerado **localmente**: `$HOME\JanuarioLeads-Backups\januario-prod-20261117T225954Z.dump.gpg`;
- Manifesto local correspondente: `januario-prod-20261117T225954Z-manifest.json`, com hash SHA256;
- Nenhum dado de cliente, arquivo de backup ou senha de banco/GPG foi enviado ao repositório ou à ferramenta nesta ação.

**Escopo da verificação:** resultado **reportado pelo usuário com log**; este ambiente não inspecionou o conteúdo local nem recalculou o hash de forma independente. O teste de leitura de índice **não prova restauração**. Portanto 0.2B tem exportação realizada, 0.2C (bytes Storage) e 0.2D (restore isolado) permanecem pendentes.

## 0.2C — Backup dos bytes de Storage: OBRIGATÓRIO E NÃO REALIZADO

O bucket **privado** `prompt-visual-references` contém **9 objetos** (metadados totalizam **760.690 bytes**). A exportação SQL contém apenas referências/metadados. Duas opções sem acesso público:

- Manualmente baixar os nove objetos em **Storage > Files** no Dashboard de PROD, guardá-los preservando pastas/nomes em volume cifrado e validar contagem/tamanhos; ou
- Com Python 3 e a **`sb_secret_` de PRODUÇÃO**, executar no PC (o script só solicita chave no prompt oculto e usa o cabeçalho `apikey`, sem Bearer):

```powershell
python scripts/fase0-backup-storage-producao.py --directory "E:\Backups-Criptografados" --confirm-encrypted-volume --expected-count 9 --expected-bytes 760690
```

O script verifica individualmente bytes/sha256, remove a pasta parcial se houver falha, impede caminhos inseguros e só faz GET/listagem. **Não foi testado com a credencial real de PROD**; se retornar HTTP 401/403 ou nomes diferentes, interromper e usar a opção manual, sem compartilhar segredo. Se novos arquivos forem adicionados, refazer o inventário antes de mudar `--expected-count` ou `--expected-bytes`.

## 0.2D — Teste de restauração ISOLADA: OBRIGATÓRIO E NÃO REALIZADO

**Nunca restaurar ou executar `pg_restore` em PRODUÇÃO.** Primeiro selecionar ambiente descartável (PostgreSQL/Supabase local via Docker, preferencialmente self-hosted Supabase de teste) com extensões, roles e schemas compatíveis. Não criar projetos Supabase pagos ou novos ambientes remotos sem autorização do proprietário.

Aprovar apenas se:
1. Descriptografia íntegra e SHA-256 do pacote conferidos;
2. Banco foi **de fato restaurado** e consultas retornam ao menos 212 leads, 259 atividades, 2 usuários Auth, 3 identidades, além de tabelas, índices e políticas RLS, com diferenças documentadas;
3. Metadados de Storage recuperados e **9 arquivos reais** abrem e correspondem aos SHA-256; acesso privado preservado;
4. Configurações de Auth, funções e segredos necessários à recuperação foram documentados **fora do backup compartilhável**;
5. Resultado, limitações e instruções de recuperação estão em manifesto privado assinado/datado; nenhuma linha com dados pessoais ou segredo é exibida no CI.

**Status oficial de Fase 0.2: PENDENTE.** Scripts preparados e testados offline não equivalem a backup real ou restauração bem-sucedida. Não autorizar migração Overture à produção nem publicar beta até cumprir este portão.

## Referências
- [Backups no plano Free](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Restauração de Supabase em self-hosted](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Download de objetos Storage](https://supabase.com/docs/guides/storage/management/download-objects)
