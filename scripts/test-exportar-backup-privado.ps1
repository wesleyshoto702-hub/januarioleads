# Unit tests use fake Supabase and Docker functions; they NEVER invoke
# real CLI commands, Supabase Cloud, databases, paid APIs or customer data.
$ErrorActionPreference = "Stop"
$Root = Join-Path ([IO.Path]::GetTempPath()) ("januario-private-backup-test-" + [guid]::NewGuid().ToString("N"))
$Projeto = Join-Path $Root "checkout"
$Criptografado = Join-Path $Root "fake-encrypted-disk"
$Vinculo = Join-Path $Projeto "supabase/.temp"
$Script = Join-Path $PSScriptRoot "exportar-backup-privado.ps1"
$Verificador = Join-Path $PSScriptRoot "verificar-integridade-backup-privado.ps1"
$global:CliVersao = "3.0.0"

function global:supabase {
  if ($args.Count -eq 1 -and $args[0] -eq "--version") {
    $global:LASTEXITCODE = 0
    Write-Output $global:CliVersao
    return
  }
  # Asserts explicit targets for CLI v2/v3. Never calls real Supabase.
  if ($global:CliVersao.StartsWith("3.") -and
      ($args -notcontains "--remote=czkazbianiflhldenhcj" -or $args -contains "--linked")) {
    throw "UNSAFE: CLI v3 requires exact production ref"
  }
  if ($global:CliVersao.StartsWith("2.") -and
      ($args -notcontains "--linked" -or $args -contains "--remote=czkazbianiflhldenhcj")) {
    throw "UNSAFE: CLI v2 requires --linked"
  }
  if ($args -contains "--data-only" -and
      ($args -notcontains "storage.buckets_vectors" -or
       $args -notcontains "storage.vector_indexes")) {
    throw "UNSAFE: vector storage exclusions missing"
  }
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

  # CLI v3 successful mock export, manifest, and corruption check.
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
      $Manifesto.serie_cli -ne "3.x" -or
      @($Manifesto.arquivos).Count -ne 3) {
    throw "Unexpected backup manifest contract"
  }
  foreach ($Entrada in $Manifesto.arquivos) {
    if (-not ($Entrada.sha256 -match '^[0-9a-f]{64}$')) { throw "Missing SHA-256" }
  }
  & $Verificador -PastaBackup $Dir

  Add-Content -LiteralPath (Join-Path $Dir "data.sql") -Value "CORRUPTED-OFFLINE"
  ExigirBloqueio {
    & $Verificador -PastaBackup $Dir
  } "tampered backup hash"

  # CLI v2 must remain supported.
  $global:CliVersao = "2.122.1"
  & $Script -Destino $Criptografado -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  $Backups = @(Get-ChildItem -LiteralPath $Criptografado -Directory)
  if ($Backups.Count -ne 2) { throw "Expected successful v2 and v3 test exports" }
  $ManifestosV2 = @(Get-ChildItem -LiteralPath $Criptografado -Filter "manifesto-privado.json" -Recurse |
    ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json } |
    Where-Object { $_.serie_cli -eq "2.x" })
  if ($ManifestosV2.Count -ne 1) { throw "Expected a single mocked v2 export" }

  # Future major must fail closed.
  $global:CliVersao = "4.0.0"
  ExigirBloqueio {
    & $Script -Destino $Criptografado -DiretorioProjeto $Projeto -ConfirmoVolumeCriptografado
  } "unsupported future CLI major"
  if (@(Get-ChildItem -LiteralPath $Criptografado -Directory).Count -ne 2) {
    throw "UNSAFE: unsupported CLI version created backup output"
  }
  Write-Host "PASS: offline guards, v2/v3 target selection, hash tamper and future-version refusal."
} finally {
  Remove-Item -LiteralPath $Root -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item function:\supabase -ErrorAction SilentlyContinue
  Remove-Item function:\docker -ErrorAction SilentlyContinue
  Remove-Variable -Name CliVersao -Scope Global -ErrorAction SilentlyContinue
}