#Requires -Version 5.1
<#
.SYNOPSIS
  Exporta uma copia SQL PRIVADA do Supabase do Januario Leads no computador do dono.

.DESCRIPTION
  Este script NAO envia dados ao GitHub, ChatGPT ou qualquer outro servico.
  O destino deve estar em volume ja criptografado e FORA do repositorio.
  Exige Supabase CLI autenticada e vinculada ao projeto correto.
  NAO restaura nem aplica migrations: um backup exportado NAO comprova restore.

.EXAMPLE
  .\scripts\exportar-backup-privado.ps1 -Destino "E:\Backups-Criptografados" -ConfirmoVolumeCriptografado

#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Destino,

  [switch]$ConfirmoVolumeCriptografado,

  [string]$DiretorioProjeto = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$ProjetoEsperado = "czkazbianiflhldenhcj"

if (-not $ConfirmoVolumeCriptografado) {
  throw "BLOQUEADO: confirme que o destino e um volume criptografado (BitLocker/VeraCrypt ou equivalente)."
}

if (-not (Test-Path -LiteralPath $Destino -PathType Container)) {
  throw "BLOQUEADO: crie e desbloqueie uma pasta em volume criptografado ANTES de executar."
}

$Projeto = (Resolve-Path -LiteralPath $DiretorioProjeto).Path
$DestinoReal = (Resolve-Path -LiteralPath $Destino).Path
$Comparacao = [System.StringComparison]::OrdinalIgnoreCase
$ProjetoNormalizado = $Projeto.TrimEnd([char[]]@('/', '\'))
$DestinoNormalizado = $DestinoReal.TrimEnd([char[]]@('/', '\'))
$Separador = [System.IO.Path]::DirectorySeparatorChar

if ($DestinoNormalizado.Equals($ProjetoNormalizado, $Comparacao) -or
    $DestinoNormalizado.StartsWith($ProjetoNormalizado + $Separador, $Comparacao)) {
  throw "BLOQUEADO: nao salve backups dentro do repositorio Git."
}

$Vinculo = Join-Path $Projeto "supabase/.temp/project-ref"
if (-not (Test-Path -LiteralPath $Vinculo -PathType Leaf)) {
  throw "BLOQUEADO: execute 'supabase login' e 'supabase link --project-ref $ProjetoEsperado' no seu computador antes do backup."
}
$Ref = (Get-Content -LiteralPath $Vinculo -Raw -Encoding UTF8).Trim()
if ($Ref -cne $ProjetoEsperado) {
  throw "BLOQUEADO: o diretorio local esta conectado a OUTRO projeto Supabase."
}
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw "BLOQUEADO: Supabase CLI nao instalada ou indisponivel no PATH."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "BLOQUEADO: Docker Desktop deve estar instalado e iniciado para o dump oficial."
}

# CLI v3 (2026-11) usa --remote; v2 usa --linked. Nunca fazer dump sem alvo explicito.
$SaidaVersao = @(& supabase --version 2>$null)
if ($LASTEXITCODE -ne 0 -or $SaidaVersao.Count -eq 0) {
  throw "BLOQUEADO: nao foi possivel identificar a versao da Supabase CLI."
}
$TextoVersao = ($SaidaVersao -join " ").Trim()
if ($TextoVersao -notmatch '(?i)\b(?:supabase\s+)?v?([0-9]+)\.[0-9]+\.[0-9]+') {
  throw "BLOQUEADO: formato de versao desconhecido da Supabase CLI."
}
$VersaoPrincipal = [int]$Matches[1]
if ($VersaoPrincipal -eq 2) {
  $AlvoRemoto = "--linked"
} elseif ($VersaoPrincipal -eq 3) {
  $AlvoRemoto = "--remote"
} else {
  throw "BLOQUEADO: serie da Supabase CLI nao auditada; revise o script antes de exportar."
}

$Nome = "Januario-Leads-Privado-" + (Get-Date -Format "yyyyMMdd-HHmmss") +
        "-" + [guid]::NewGuid().ToString("N").Substring(0, 8)
$Pasta = Join-Path $DestinoReal $Nome
$Completo = $false

try {
  New-Item -ItemType Directory -Path $Pasta -ErrorAction Stop | Out-Null

  Push-Location -LiteralPath $Projeto
  try {
    # --linked (v2) / --remote (v3): alvo hospedado explicito, sem URL/senha na linha de comando.
    # Tokens/senhas de acesso sao tratados pelo ambiente LOCAL do Supabase CLI.
    $Perfis = @(
      @{ Arquivo = "roles.sql"; Argumentos = @("--role-only") },
      @{ Arquivo = "schema.sql"; Argumentos = @() },
      @{ Arquivo = "data.sql"; Argumentos = @("--data-only", "--use-copy", "-x", "storage.buckets_vectors", "-x", "storage.vector_indexes") }
    )

    foreach ($Perfil in $Perfis) {
      $Arquivo = Join-Path $Pasta $Perfil.Arquivo
      $Argumentos = @("db", "dump", $AlvoRemoto, "--file", $Arquivo) + $Perfil.Argumentos
      # Nunca exibir stdout/stderr de uma ferramenta que conhece credenciais.
      & supabase @Argumentos 1>$null 2>$null
      if ($LASTEXITCODE -ne 0) {
        throw ("BLOQUEADO: exportacao {0} falhou (codigo {1}). Sem backup valido." -f
               $Perfil.Arquivo, $LASTEXITCODE)
      }
      if (-not (Test-Path -LiteralPath $Arquivo -PathType Leaf)) {
        throw "BLOQUEADO: Supabase CLI nao gerou o arquivo esperado."
      }
      if ((Get-Item -LiteralPath $Arquivo).Length -eq 0) {
        throw "BLOQUEADO: um dos arquivos exportados esta vazio."
      }
    }
  } finally {
    Pop-Location
  }

  $Inventario = foreach ($NomeArquivo in @("roles.sql", "schema.sql", "data.sql")) {
    $Arquivo = Join-Path $Pasta $NomeArquivo
    [ordered]@{
      arquivo = $NomeArquivo
      tamanho_bytes = (Get-Item -LiteralPath $Arquivo).Length
      sha256 = (Get-FileHash -LiteralPath $Arquivo -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  $Manifesto = [ordered]@{
    projeto = $ProjetoEsperado
    criado_em = (Get-Date).ToUniversalTime().ToString("o")
    situacao = "EXPORTADO_NAO_RESTAURADO"
    serie_cli = "$VersaoPrincipal.x"
    lembrete = "Dados sensiveis; nao compartilhar, subir no GitHub nem anexar a chats."
    arquivos = @($Inventario)
  }
  $Manifesto | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $Pasta "manifesto-privado.json") -Encoding UTF8

  $Completo = $true
  Write-Host "EXPORTACAO LOCAL CONCLUIDA. NAO E COMPROVACAO DE RESTORE."
  Write-Host "Destino criptografado informado: $Pasta"
  Write-Host "Proximo passo: testar restauracao em banco local DESCARTAVEL."
  Write-Host "Nao copie SQLs para GitHub, tickets, chats ou artefatos de CI."
} finally {
  if (-not $Completo -and (Test-Path -LiteralPath $Pasta)) {
    Remove-Item -LiteralPath $Pasta -Recurse -Force -ErrorAction SilentlyContinue
  }
}
