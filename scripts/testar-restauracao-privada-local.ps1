#Requires -Version 5.1
<#
.SYNOPSIS
  Restaura backup privado SOMENTE em Supabase local descartavel.
.DESCRIPTION
  Nunca aceita URL, host ou porta remotos. Exige Postgres 17 via
  Docker publicado EXCLUSIVAMENTE em 127.0.0.1:54322.
  Nao comprova recuperacao de objetos Storage, Auth externo ou Edge.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string]$PastaBackup,
  [Parameter(Mandatory = $true)] [string]$DiretorioSupabaseLocal,
  [switch]$ConfirmoAmbienteDescartavel,
  [switch]$ConfirmoArmazenamentoCriptografado
)
$ErrorActionPreference = "Stop"
$ProjetoEsperado = "czkazbianiflhldenhcj"

if (-not $ConfirmoAmbienteDescartavel -or -not $ConfirmoArmazenamentoCriptografado) {
  throw "BLOQUEADO: confirme stack descartavel e armazenamento criptografado."
}
if (-not (Test-Path -LiteralPath $PastaBackup -PathType Container) -or
    -not (Test-Path -LiteralPath $DiretorioSupabaseLocal -PathType Container)) {
  throw "BLOQUEADO: backup ou laboratorio inexistente."
}
$Backup = (Resolve-Path -LiteralPath $PastaBackup).Path
$Lab = (Resolve-Path -LiteralPath $DiretorioSupabaseLocal).Path
$Repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$Cmp = [System.StringComparison]::OrdinalIgnoreCase
$Sep = [System.IO.Path]::DirectorySeparatorChar
$LabNormal = $Lab.TrimEnd([char[]]@('/', '\'))
$RepoNormal = $Repo.TrimEnd([char[]]@('/', '\'))
if ($LabNormal.Equals($RepoNormal, $Cmp) -or $LabNormal.StartsWith($RepoNormal + $Sep, $Cmp)) {
  throw "BLOQUEADO: laboratorio nao pode estar dentro do checkout de producao."
}
if ($Lab.Equals($Backup, $Cmp) -or
    $Lab.StartsWith($Backup.TrimEnd([char[]]@('/', '\')) + $Sep, $Cmp)) {
  throw "BLOQUEADO: laboratorio nao pode ficar dentro da pasta do dump."
}
if (-not (Test-Path -LiteralPath (Join-Path $Lab "supabase/config.toml") -PathType Leaf)) {
  throw "BLOQUEADO: use um projeto Supabase local independente e inicializado."
}
if (Test-Path -LiteralPath (Join-Path $Lab "supabase/.temp/project-ref")) {
  throw "BLOQUEADO: laboratorio tem vinculo a projeto hospedado."
}
if (-not (Get-Command psql -ErrorAction SilentlyContinue) -or
    -not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "BLOQUEADO: psql e Docker devem estar instalados."
}

& (Join-Path $PSScriptRoot "verificar-integridade-backup-privado.ps1") -PastaBackup $Backup

# Verifica que 54322 foi publicada no loopback por container Supabase,
# em vez de um tunnel para producao.
$Containers = @(& docker ps --filter "publish=54322" --format "{{.Image}}|{{.Ports}}" 2>$null)
if ($LASTEXITCODE -ne 0) { throw "BLOQUEADO: nao foi possivel conferir os containers." }
$Validos = @($Containers | Where-Object {
  $_ -match 'supabase/postgres' -and $_ -match '127\.0\.0\.1:54322->5432/tcp'
})
if ($Validos.Count -ne 1) {
  throw "BLOQUEADO: exige Supabase PostgreSQL em 127.0.0.1:54322 (somente loopback)."
}

$SenhaAnterior = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")
$SenhaCriada = $false
if ([string]::IsNullOrEmpty($SenhaAnterior)) {
  $Segura = Read-Host "Senha do PostgreSQL LOCAL (nunca use a senha de producao)" -AsSecureString
  $Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Segura)
  try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr)
  }
  $SenhaCriada = $true
}

$Conexao = @("--no-psqlrc", "--no-password", "--host=127.0.0.1",
             "--port=54322", "--username=postgres", "--dbname=postgres",
             "--set=ON_ERROR_STOP=1")
function TestarMarcador([string]$SQL, [string]$Marcador) {
  $Resposta = @(& psql @Conexao --quiet --no-align --tuples-only --command $SQL 2>$null)
  if ($LASTEXITCODE -ne 0 -or (($Resposta -join [Environment]::NewLine).Trim() -cne $Marcador)) {
    throw "BLOQUEADO: cheque SQL da stack local falhou."
  }
}
try {
  # Uma base preexistente, com leads ou login, e recusada.
  $Preflight = @'
select case when
  current_setting('server_version_num')::integer between 170000 and 179999
  and to_regclass('auth.users') is not null
  and not exists (select 1 from auth.users)
  and not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and c.relname <> 'spatial_ref_sys'
  )
  and to_regclass('public.private_access') is null
  and to_regclass('public.lead_payments') is null
  then 'LOCAL_VAZIO_OK' else 'BLOQUEADO' end;
'@
  TestarMarcador $Preflight "LOCAL_VAZIO_OK"

  $Roles = Join-Path $Backup "roles.sql"
  $Schema = Join-Path $Backup "schema.sql"
  $Dados = Join-Path $Backup "data.sql"
  & psql @Conexao --quiet --single-transaction --file $Roles --file $Schema --command "SET session_replication_role = replica;" --file $Dados 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "BLOQUEADO: transacao de restore falhou, nao afirmar recuperabilidade."
  }

  $Postcheck = @'
select case when
  to_regclass('auth.users') is not null
  and to_regclass('public.private_access') is not null
  and to_regclass('public.lead_payments') is not null
  and to_regclass('public.places_search_cache') is not null
  and to_regclass('public.open_now_niche_cache') is not null
  and (select count(*) from pg_policies
       where schemaname='public' and tablename in
       ('private_access','lead_payments','places_search_cache','open_now_niche_cache')) >= 7
  and not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public'
      and c.relname in ('private_access','lead_payments','places_search_cache','open_now_niche_cache')
      and not c.relrowsecurity
  )
  then 'RESTAURACAO_SQL_OK' else 'BLOQUEADO' end;
'@
  TestarMarcador $Postcheck "RESTAURACAO_SQL_OK"

  [ordered]@{
    projeto_origem = $ProjetoEsperado
    instante_utc = (Get-Date).ToUniversalTime().ToString("o")
    destino = "127.0.0.1:54322 (ambiente Supabase local descartavel)"
    status = "RESTAURACAO_SQL_LOCAL_OK"
    pendencias = @("Login real e PostgREST com contas ficticias",
                   "Comparar contagens e dependencias localmente",
                   "Storage binario, Edge, Vault, OAuth, SMTP e chaves")
  } | ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $Backup "resultado-restauracao-privado.json") -Encoding UTF8

  Write-Host "PASS: restauracao transacional de SQL em stack local e checagem RLS."
  Write-Host "PENDENTE: Auth, Storage e testes funcionais antes de aprovar producao."
} finally {
  if ($SenhaCriada) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}
