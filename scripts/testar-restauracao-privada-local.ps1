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
# Nao basta publicar em loopback: a rede do container tambem deve ser
# INTERNA, sem caminho de saida para a internet com dados restaurados.
# A rede alternativa --preparar-vazio e intencionalmente bloqueada aqui.
$ProjetoConfig = Get-Content -LiteralPath (Join-Path $Lab "supabase/config.toml") -Raw -Encoding UTF8
$ProjetoMatch = [regex]::Match($ProjetoConfig, '(?m)^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"')
if (-not $ProjetoMatch.Success -or $ProjetoMatch.Groups[1].Value -eq $ProjetoEsperado) {
  throw "BLOQUEADO: identidade do laboratorio nao confiavel."
}
$ProjetoLocal = $ProjetoMatch.Groups[1].Value
$Containers = @(& docker ps --filter "publish=54322" --format "{{.ID}}|{{.Image}}|{{.Ports}}" 2>$null)
if ($LASTEXITCODE -ne 0 -or $Containers.Count -ne 1) {
  throw "BLOQUEADO: porta local ausente ou com containers ambiguos."
}
$Partes = ([string]$Containers[0]).Split('|')
if ($Partes.Count -ne 3 -or
    $Partes[0] -notmatch '^[a-f0-9]{12,64}$' -or
    $Partes[1] -notmatch '^(?:public\.ecr\.aws/)?supabase/postgres:[^|]+$' -or
    $Partes[2] -cne '127.0.0.1:54322->5432/tcp') {
  throw "BLOQUEADO: exige PostgreSQL Supabase com uma unica porta local."
}
$ContainerId = $Partes[0]
$RotulosJson = @(& docker inspect --format "{{json .Config.Labels}}" $ContainerId 2>$null)
if ($LASTEXITCODE -ne 0 -or $RotulosJson.Count -ne 1) {
  throw "BLOQUEADO: nao foi possivel validar o projeto do container."
}
try {
  $Rotulos = ($RotulosJson[0] | ConvertFrom-Json)
  $Rotulo = $Rotulos.PSObject.Properties["com.supabase.cli.project"]
  if (-not $Rotulo -or $Rotulo.Value -cne $ProjetoLocal) {
    throw "Projeto local divergente."
  }
} catch {
  throw "BLOQUEADO: container nao pertence ao projeto de laboratorio esperado."
}
$RedesJson = @(& docker inspect --format "{{json .NetworkSettings.Networks}}" $ContainerId 2>$null)
if ($LASTEXITCODE -ne 0 -or $RedesJson.Count -ne 1) {
  throw "BLOQUEADO: nao foi possivel validar as redes do container."
}
try {
  $Redes = ($RedesJson[0] | ConvertFrom-Json)
  $NomesRedes = @($Redes.PSObject.Properties.Name)
  if ($NomesRedes.Count -ne 1 -or $NomesRedes[0] -cne "januario-restore-local") {
    throw "Rede externa ou inesperada."
  }
} catch {
  throw "BLOQUEADO: laboratorio nao esta isolado em rede interna exclusiva."
}
$RedeInterna = @(& docker network inspect "januario-restore-local" --format "{{.Internal}}" 2>$null)
if ($LASTEXITCODE -ne 0 -or $RedeInterna.Count -ne 1 -or
    ([string]$RedeInterna[0]).Trim() -cne "true") {
  throw "BLOQUEADO: rede Docker permite conexoes de saida. Nao restaurar dados."
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
