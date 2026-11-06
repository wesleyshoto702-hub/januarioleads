# Mocks offline: NUNCA executa psql, Docker ou CLI reais contra clientes.
$ErrorActionPreference = "Stop"
$Raiz = Join-Path ([IO.Path]::GetTempPath()) ("januario-restore-mock-" + [guid]::NewGuid().ToString("N"))
$Lab = Join-Path $Raiz "lab"
$Backup = Join-Path $Raiz "backup"
$Roteiro = Join-Path $PSScriptRoot "testar-restauracao-privada-local.ps1"
$SenhaAnterior = [Environment]::GetEnvironmentVariable("PGPASSWORD", "Process")

function global:docker {
  $global:LASTEXITCODE = 0
  if ($args[0] -eq "ps") {
    if ($global:PortasMock) {
      foreach ($Item in @($global:PortasMock)) { Write-Output ("0123456789ab|" + $Item) }
    } elseif ($global:PortaInsegura) {
      Write-Output "0123456789ab|postgres:17|0.0.0.0:54322->5432/tcp"
    } else {
      Write-Output "0123456789ab|supabase/postgres:17.6.1.084|127.0.0.1:54322->5432/tcp"
    }
  } elseif ($args[0] -eq "inspect") {
    if ($args -contains "{{json .Config.Labels}}") {
      if ($global:ProjetoIncorreto) {
        Write-Output '{"com.supabase.cli.project":"OutroProjeto"}'
      } else {
        Write-Output '{"com.supabase.cli.project":"Lab"}'
      }
    } elseif ($args -contains "{{json .NetworkSettings.Networks}}") {
      if ($global:RedeExtra) {
        Write-Output '{"januario-restore-local":{},"bridge":{}}'
      } elseif ($global:RedeErrada) {
        Write-Output '{"januario-restore-loopback":{}}'
      } else {
        Write-Output '{"januario-restore-local":{}}'
      }
    } else {
      throw "UNSAFE: docker inspect inesperado"
    }
  } elseif ($args[0] -eq "network" -and $args[1] -eq "inspect") {
    Write-Output $(if ($global:RedeNaoInterna) { "false" } else { "true" })
  } else {
    throw "UNSAFE: docker comando inesperado"
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
  Set-Content -LiteralPath (Join-Path $Lab "supabase/config.toml") -Value 'project_id = "Lab"'
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

  foreach ($Portas in @(
    "supabase/postgres:17|127.0.0.1:54322->5432/tcp, 0.0.0.0:54323->5432/tcp",
    "supabase/postgres:17|127.0.0.1:54322->5432/tcp, [::]:54323->5432/tcp",
    "untrusted/supabase/postgres:17|127.0.0.1:54322->5432/tcp"
  )) {
    $global:PortasMock = $Portas
    ExigirBloqueio { & $Roteiro @Argumentos } "publicacao adicional ou imagem nao reconhecida"
  }
  $global:PortasMock = @(
    "supabase/postgres:17|127.0.0.1:54322->5432/tcp",
    "supabase/postgres:17|0.0.0.0:54322->5432/tcp"
  )
  ExigirBloqueio { & $Roteiro @Argumentos } "containers ambiguos"
  $global:PortasMock = $null

  $global:RedeNaoInterna = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "rede com saida para internet"
  $global:RedeNaoInterna = $false

  $global:RedeExtra = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "container conectado em duas redes"
  $global:RedeExtra = $false

  $global:RedeErrada = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "rede de preparacao vazia nao e segura para restaurar"
  $global:RedeErrada = $false

  $global:ProjetoIncorreto = $true
  ExigirBloqueio { & $Roteiro @Argumentos } "container nao pertence ao laboratorio"
  $global:ProjetoIncorreto = $false

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
  foreach ($Chave in @("PortasMock","PortaInsegura","BloquearPreflight","FalharRestore","BloquearPostcheck","RedeNaoInterna","RedeExtra","RedeErrada","ProjetoIncorreto")) {
    Remove-Variable -Name $Chave -Scope Global -ErrorAction SilentlyContinue
  }
}
