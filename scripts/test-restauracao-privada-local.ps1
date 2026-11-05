# Mocks offline: NUNCA executa psql, Docker ou CLI reais contra clientes.
$ErrorActionPreference = "Stop"
$Raiz = Join-Path ([IO.Path]::GetTempPath()) ("januario-restore-mock-" + [guid]::NewGuid().ToString("N"))
$Lab = Join-Path $Raiz "lab"
$Backup = Join-Path $Raiz "backup"
$Roteiro = Join-Path $PSScriptRoot "testar-restauracao-privada-local.ps1"
$SenhaAnterior = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")

function global:docker {
  $global:LASTEXITCODE = 0
  if ($global:PortaInsegura) {
    Write-Output "postgres:17|0.0.0.0:54322->5432/tcp"
  } else {
    Write-Output "supabase/postgres:17.6.1.084|127.0.0.1:54322->5432/tcp"
  }
}
function global:psql {
  if ($args -contains "--single-transaction") {
    if ($args -notcontains "--host=127.0.0.1" -or
        $args -notcontains "--port=54322" -or
        $args -notcontains "--set=ON_ERROR_STOP=1" -or
        $args -notcontains "--dbname=postgres" -or
        $args -notcontains "--no-password") {
      throw "UNSAFE: SQL restore nao usa guardas de conexao"
    }
    if (@($args | Where-Object { $_ -eq "--file" }).Count -ne 3 -or
        $args -notcontains "SET session_replication_role = replica;") {
      throw "UNSAFE: restore nao tem os tres arquivos e o controle de triggers"
    }
    $global:LASTEXITCODE = $(if ($global:FalharRestore) { 7 } else { 0 })
    return
  }
  $SQL = ($args -join " ")
  $global:LASTEXITCODE = 0
  if ($SQL -match "LOCAL_VAZIO_OK") {
    Write-Output $(if ($global:BloquearPreflight) { "BLOQUEADO" } else { "LOCAL_VAZIO_OK" })
  } elseif ($SQL -match "RESTAURACAO_SQL_OK") {
    Write-Output $(if ($global:BloquearPostcheck) { "BLOQUEADO" } else { "RESTAURACAO_SQL_OK" })
  } else {
    throw "UNSAFE: SQL nao previsto no mock"
  }
}
function ExigirBloqueio([scriptblock]$Acao, [string]$Caso) {
  $Bloqueado = $false
  try { & $Acao } catch { $Bloqueado = $true }
  if (-not $Bloqueado) { throw "UNSAFE: bloqueio esperado nao ocorreu: $Caso" }
}
try {
  New-Item -ItemType Directory -Path (Join-Path $Lab "supabase") -Force | Out-Null
  New-Item -ItemType Directory -Path $Backup -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $Lab "supabase/config.toml") -Value "[project]"
  $Itens = foreach ($Nome in @("roles.sql","schema.sql","data.sql")) {
    $Arq = Join-Path $Backup $Nome
    Set-Content -LiteralPath $Arq -Value ("MOCK-" + $Nome)
    [ordered]@{
      arquivo = $Nome
      tamanho_bytes = (Get-Item -LiteralPath $Arq).Length
      sha256 = (Get-FileHash -LiteralPath $Arq -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  [ordered]@{
    projeto = "czkazbianiflhldenhcj"
    situacao = "EXPORTADO_NAO_RESTAURADO"
    arquivos = @($Itens)
  } | ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $Backup "manifesto-privado.json") -Encoding UTF8
  $env:PGPASSWORD = "DADO-FICTICIO-PARA-MOCK"
  $Argumentos = @{
    PastaBackup = $Backup
    DiretorioSupabaseLocal = $Lab
    ConfirmoAmbienteDescartavel = $true
    ConfirmoArmazenamentoCriptografado = $true
  }
  ExigirBloqueio {
    & $Roteiro -PastaBackup $Backup -DiretorioSupabaseLocal $Lab -ConfirmoAmbienteDescartavel
  } "falta confirmacao de armazenamento"

  New-Item -ItemType Directory -Path (Join-Path $Lab "supabase/.temp") -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $Lab "supabase/.temp/project-ref") -Value "czkazbianiflhldenhcj"
  ExigirBloqueio { & $Roteiro @Argumentos } "laboratorio vinculado ao remoto"
  Remove-Item -LiteralPath (Join-Path $Lab "supabase/.temp/project-ref")

  $global:PortaInsegura = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "porta publicada fora do loopback"
  $global:PortaInsegura = $false

  $global:BloquearPreflight = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "stack nao vazia"
  $global:BloquearPreflight = $false

  $global:FalharRestore = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "transacao de restore falhou"
  $global:FalharRestore = $false
  if (Test-Path -LiteralPath (Join-Path $Backup "resultado-restauracao-privado.json")) {
    throw "UNSAFE: marcou sucesso apos restore falhado"
  }

  $global:BloquearPostcheck = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "postcheck insuficiente"
  $global:BloquearPostcheck = $false
  if (Test-Path -LiteralPath (Join-Path $Backup "resultado-restauracao-privado.json")) {
    throw "UNSAFE: marcou sucesso apos postcheck falhado"
  }

  # Alteracao de dados deve ser barrada pelo verificador SHA-256.
  Add-Content -LiteralPath (Join-Path $Backup "data.sql") -Value "MODIFICADO"
  ExigirBloqueio { & $Roteiro @Argumentos } "arquivo alterado"
  Set-Content -LiteralPath (Join-Path $Backup "data.sql") -Value "MOCK-data.sql"

  & $Roteiro @Argumentos
  $Relatorio = Get-Content -LiteralPath (Join-Path $Backup "resultado-restauracao-privado.json") -Raw | ConvertFrom-Json
  if ($Relatorio.status -ne "RESTAURACAO_SQL_LOCAL_OK" -or
      $Relatorio.projeto_origem -ne "czkazbianiflhldenhcj") {
    throw "Resultado de restore offline inesperado"
  }
  Write-Host "PASS: mock restauracao local, bloqueio de link, porta, preflight, hash, rollback e postcheck."
} finally {
  if ($null -eq $SenhaAnterior) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
  else { $env:PGPASSWORD = $SenhaAnterior }
  Remove-Item -LiteralPath $Raiz -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item function:\psql -ErrorAction SilentlyContinue
  Remove-Item function:\docker -ErrorAction SilentlyContinue
  foreach ($Chave in @("PortaInsegura","BloquearPreflight","FalharRestore","BloquearPostcheck")) {
    Remove-Variable -Name $Chave -Scope Global -ErrorAction SilentlyContinue
  }
}
