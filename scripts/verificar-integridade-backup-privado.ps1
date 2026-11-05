#Requires -Version 5.1
<#
.SYNOPSIS
  Verifica integridade (tamanho e SHA-256) de um backup PRIVADO local.
.DESCRIPTION
  Nao abre conexao de rede, nao executa SQL, nao imprime dados dos arquivos.
  Um PASS de hashes NAO comprova que a restauracao funciona.
.EXAMPLE
  .\scripts\verificar-integridade-backup-privado.ps1 -PastaBackup "E:\Backups-Criptografados\Januario-Leads-Privado-..."
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$PastaBackup
)

$ErrorActionPreference = "Stop"
$ProjetoEsperado = "czkazbianiflhldenhcj"
$NomesEsperados = @("roles.sql", "schema.sql", "data.sql")

if (-not (Test-Path -LiteralPath $PastaBackup -PathType Container)) {
  throw "BLOQUEADO: pasta privada de backup nao encontrada."
}

$ManifestoArquivo = Join-Path $PastaBackup "manifesto-privado.json"
if (-not (Test-Path -LiteralPath $ManifestoArquivo -PathType Leaf)) {
  throw "BLOQUEADO: manifesto privado ausente."
}

$Manifesto = Get-Content -LiteralPath $ManifestoArquivo -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Manifesto.projeto -cne $ProjetoEsperado -or
    $Manifesto.situacao -cne "EXPORTADO_NAO_RESTAURADO") {
  throw "BLOQUEADO: projeto ou estado do manifesto inesperado."
}

$Entradas = @($Manifesto.arquivos)
if ($Entradas.Count -ne $NomesEsperados.Count) {
  throw "BLOQUEADO: quantidade de arquivos diferente do contrato."
}

foreach ($Nome in $NomesEsperados) {
  $Encontradas = @($Entradas | Where-Object { $_.arquivo -ceq $Nome })
  if ($Encontradas.Count -ne 1) {
    throw "BLOQUEADO: arquivo esperado ausente ou duplicado no manifesto."
  }

  $Arquivo = Join-Path $PastaBackup $Nome
  if (-not (Test-Path -LiteralPath $Arquivo -PathType Leaf)) {
    throw "BLOQUEADO: SQL esperado ausente."
  }

  $Entrada = $Encontradas[0]
  $Tamanho = (Get-Item -LiteralPath $Arquivo).Length
  if ($Tamanho -le 0 -or $Tamanho -ne [long]$Entrada.tamanho_bytes) {
    throw "BLOQUEADO: tamanho do SQL nao corresponde ao manifesto."
  }

  $Hash = (Get-FileHash -LiteralPath $Arquivo -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Entrada.sha256 -cne $Hash) {
    throw "BLOQUEADO: SHA-256 divergente. Nao use este backup."
  }
}

Write-Host "PASS: integridade local verificada (3 SQLs, tamanho e SHA-256)."
Write-Host "ATENCAO: isso NAO comprova uma restauracao recuperavel."
