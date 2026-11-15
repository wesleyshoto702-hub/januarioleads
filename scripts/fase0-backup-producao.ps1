#requires -Version 5.1
<#
.SYNOPSIS
  Phase 0: create a locally encrypted backup of JANUARIO LEADS PRODUCTION.
.DESCRIPTION
  This script never connects to staging, writes to a remote database,
  or uploads client data to GitHub/ChatGPT. It requires PostgreSQL pg_dump
  + pg_restore and GnuPG (gpg) installed locally.
  It includes public/auth/storage SCHEMAS AND ROW DATA, but not Storage object
  payloads, Edge Function secrets, custom database roles, or an isolated
  restore trial. Use the official Supabase restore guide before recovery.
  The output is AES256 symmetric-GPG-encrypted using a passphrase the user
  enters directly into GnuPG, never to a shell command.
#>
[CmdletBinding()]
param(
  [ValidateSet('Check','Backup')][string]$Mode = 'Check',
  [string]$OutputDirectory = (Join-Path $HOME 'JanuarioLeads-Backups')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRef = 'czkazbianiflhldenhcj'
$expectedPoolerUser = 'postgres.czkazbianiflhldenhcj'
$expectedDirectHost = 'db.czkazbianiflhldenhcj.supabase.co'

function Assert-Executable([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Falta o programa $name. Instale PostgreSQL client / GnuPG e abra um novo PowerShell."
  }
}
function Assert-CommandResult([string]$name) {
  if ($LASTEXITCODE -ne 0) { throw "$name terminou com erro (codigo $LASTEXITCODE)." }
}

Assert-Executable 'pg_dump'
Assert-Executable 'pg_restore'
Assert-Executable 'gpg'

if ($Mode -eq 'Check') {
  Write-Host 'Pre-requisitos encontrados. Nenhuma conexao com Supabase foi realizada.'
  Write-Host 'Para criar backup, execute novamente com -Mode Backup.'
  return
}

Write-Host 'PRODUCAO SOMENTE: projeto czkazbianiflhldenhcj.'
Write-Host 'Copie o HOST e o USER da conexao de Session Pooler (porta 5432) em Supabase > Connect.'
Write-Host 'Nao forneca URL com senha; digite somente host e usuario separados.'
$databaseHost = (Read-Host 'Host (sem protocolo)').Trim()
$databaseUser = (Read-Host 'Usuario PostgreSQL').Trim()
$port = 5432
if ($databaseHost -eq $expectedDirectHost) {
  if ($databaseUser -ne 'postgres') { throw 'Usuario inesperado para conexao direta de producao.' }
}
elseif ($databaseHost -match '^[A-Za-z0-9-]+\.pooler\.supabase\.com$') {
  if ($databaseUser -ne $expectedPoolerUser) { throw 'Usuario inesperado para Session Pooler de producao.' }
}
else {
  throw 'Host nao autorizado: use somente a conexao direta da producao ou Session Pooler oficial.'
}
$confirm = (Read-Host 'Para confirmar backup SOMENTE da PRODUCAO, digite BACKUP_PRODUCAO').Trim()
if ($confirm -cne 'BACKUP_PRODUCAO') { throw 'Operacao cancelada por falta de confirmacao.' }

if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
}
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$archive = Join-Path $output "januario-prod-$stamp.dump.gpg"
$manifest = Join-Path $output "januario-prod-$stamp-manifest.json"
$tempDump = Join-Path $env:TEMP ("januario-prod-" + [guid]::NewGuid().ToString('N') + '.dump')
$tempVerify = Join-Path $env:TEMP ("januario-verify-" + [guid]::NewGuid().ToString('N') + '.dump')
$oldPgSslMode = [Environment]::GetEnvironmentVariable('PGSSLMODE','Process')
$oldPgConnectTimeout = [Environment]::GetEnvironmentVariable('PGCONNECT_TIMEOUT','Process')
$ok = $false
$secretBstr = [IntPtr]::Zero
try {
  $securedPassword = Read-Host 'Senha de BANCO DE DADOS da PRODUCAO (campo oculto)' -AsSecureString
  $secretBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securedPassword)
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretBstr)
  $env:PGSSLMODE = 'require'
  $env:PGCONNECT_TIMEOUT = '20'

  # pg_dump connects READ-ONLY; no client or company rows are printed.
  $args = @(
    '--host', $databaseHost, '--port', "$port",
    '--username', $databaseUser, '--dbname', 'postgres',
    '--format', 'custom', '--no-owner', '--no-acl',
    '--schema', 'public', '--schema', 'auth', '--schema', 'storage',
    '--file', $tempDump, '--verbose'
  )
  & pg_dump @args
  Assert-CommandResult 'pg_dump'
  if (-not (Test-Path -LiteralPath $tempDump)) { throw 'pg_dump nao criou um arquivo.' }
  & pg_restore --list $tempDump > $null
  Assert-CommandResult 'pg_restore --list'

  # GnuPG requests its own passphrase interactively; never pass it on command line.
  & gpg --no-symkey-cache --symmetric --cipher-algo AES256 --output $archive $tempDump
  Assert-CommandResult 'gpg --symmetric'
  if (-not (Test-Path -LiteralPath $archive)) { throw 'GPG nao criou arquivo cifrado.' }
  # Decrypt to a temporary local file and verify that the archive can be indexed.
  & gpg --no-symkey-cache --decrypt --output $tempVerify $archive
  Assert-CommandResult 'gpg --decrypt'
  & pg_restore --list $tempVerify > $null
  Assert-CommandResult 'pg_restore --list apos descriptografia'

  $meta = [ordered]@{
    project_ref = $projectRef
    exported_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    schemas = @('public','auth','storage')
    database_host = $databaseHost
    archive_file = [IO.Path]::GetFileName($archive)
    archive_size_bytes = (Get-Item -LiteralPath $archive).Length
    archive_sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    encryption = 'GnuPG AES256 symmetric (passphrase not stored)'
    pg_restore_archive_list_verified = $true
    isolated_database_restore_verified = $false
    caveats = @(
      'Nao inclui conteudo dos arquivos Supabase Storage, apenas metadados.',
      'Nao inclui secrets de Edge Functions, chaves Auth ou roles globais.',
      'pg_restore --list verifica formato, NAO garante restauracao completa.',
      'Nao transferir este backup para GitHub, email ou ChatGPT.'
    )
  }
  $meta | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifest -Encoding UTF8
  $ok = $true
  Write-Host "BACKUP LOCAL CRIPTOGRAFADO: $archive"
  Write-Host "MANIFESTO SEM DADOS DE CLIENTES: $manifest"
  Write-Host 'Verificacao de arquivo OK. Restauracao real em banco isolado AINDA PENDENTE.'
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  [Environment]::SetEnvironmentVariable('PGSSLMODE',$oldPgSslMode,'Process')
  [Environment]::SetEnvironmentVariable('PGCONNECT_TIMEOUT',$oldPgConnectTimeout,'Process')
  if ($secretBstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretBstr)
  }
  if (Test-Path -LiteralPath $tempDump) { Remove-Item -LiteralPath $tempDump -Force }
  if (Test-Path -LiteralPath $tempVerify) { Remove-Item -LiteralPath $tempVerify -Force }
  if (-not $ok -and (Test-Path -LiteralPath $archive)) {
    Remove-Item -LiteralPath $archive -Force
  }
}
