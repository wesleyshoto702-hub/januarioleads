# Unit tests use fake Supabase and Docker functions; they NEVER invoke
# real CLI commands, Supabase Cloud, databases, paid APIs or customer data.
$ErrorActionPreference = "Stop"
$Root = Join-Path ([IO.Path]::GetTempPath()) ("januario-private-backup-test-" + [guid]::NewGuid().ToString("N"))
$Projeto = Join-Path $Root "checkout"
$Criptografado = Join-Path $Root "fake-encrypted-disk"
$Vinculo = Join-Path $Projeto "supabase/.temp"
$Script = Join-Path $PSScriptRoot "exportar-backup-privado.ps1"

function global:supabase {
  $Idx = [array]::IndexOf([string[]]$args, "--file")
  if ($Idx -lt 0 -or $Idx + 1 -ge $args.Count) { throw "Mock unexpected CLI arguments" }
  $File = [string]$args[$Idx + 1]
  if ($global:FalharDados -and $args -contains "--data-only") {
    $global:LASTEXITCODE = 9
    return
  }
  [System.IO.File]::WriteAllText($File, ("MOCKED-ONLY " + ($args -join ",")))
  $global:LASTEXITCODE = 0
}
function global:docker { $global:LASTEXITCODE = 0 }

function ExigirBloqueio([scriptblock]$Acao, [string]$Caso) {
  $Bloqueou = $false
  try { & $Acao } catch { $Bloqueou = $true }
  if (-not $Bloqueou) { throw "UNSAFE: expected helper to block: $Caso" }
}

try {
  New-Item -Path $Vinculo -ItemType Directory -Force | Out-Null
  New-Item -Path $Criptografado -ItemType Directory -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $Vinculo "project-ref") -Value "czkazbianiflhldenhcj"

  ExigirBloqueio {
    & $Script -Destino $Criptografado -DiretorioProjeto $Projeto
  } "missing encrypted-volume confirmation"
  ExigirBloqueio {
    & $Script -Destino $Projeto -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  } "backup path inside git repository"

  Set-Content -LiteralPath (Join-Path $Vinculo "project-ref") -Value "outro-projeto-qualquer"
  ExigirBloqueio {
    & $Script -Destino $Criptografado -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  } "wrong linked Supabase project"
  Set-Content -LiteralPath (Join-Path $Vinculo "project-ref") -Value "czkazbianiflhldenhcj"

  $global:FalharDados = $true
  ExigirBloqueio {
    & $Script -Destino $Criptografado -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  } "partial export failure"
  if (@(Get-ChildItem -LiteralPath $Criptografado -Force).Count -ne 0) {
    throw "UNSAFE: incomplete backup files were not cleaned up"
  }

  $global:FalharDados = $false
  & $Script -Destino $Criptografado -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  $Subpastas = @(Get-ChildItem -LiteralPath $Criptografado -Directory)
  if ($Subpastas.Count -ne 1) { throw "Expected one completed local-only backup folder" }
  $Dir = $Subpastas[0].FullName
  foreach ($Nome in @("roles.sql", "schema.sql", "data.sql")) {
    if (-not (Test-Path -LiteralPath (Join-Path $Dir $Nome) -PathType Leaf)) {
      throw "Missing expected mocked SQL backup file: $Nome"
    }
  }
  $Manifesto = Get-Content -LiteralPath (Join-Path $Dir "manifesto-privado.json") -Raw | ConvertFrom-Json
  if ($Manifesto.projeto -ne "czkazbianiflhldenhcj" -or
      $Manifesto.situacao -ne "EXPORTADO_NAO_RESTAURADO" -or
      @($Manifesto.arquivos).Count -ne 3) {
    throw "Unexpected backup manifest contract"
  }
  foreach ($Entrada in $Manifesto.arquivos) {
    if (-not ($Entrada.sha256 -match '^[0-9a-f]{64}$')) { throw "Missing SHA-256" }
  }
  Write-Host "PASS: guarded offline export, wrong project refusal, cleanup and SHA-256 manifest."
} finally {
  Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item function:\supabase -ErrorAction SilentlyContinue
  Remove-Item function:\docker -ErrorAction SilentlyContinue
}
