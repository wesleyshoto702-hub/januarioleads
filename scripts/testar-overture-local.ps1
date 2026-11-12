#Requires -Version 5.1
<#
.SYNOPSIS
  Valida e, se autorizado, importa um pequeno lote Overture no Supabase STAGING.
.DESCRIPTION
  Não usa GitHub Actions, não configura cartão e não grava segredos no disco.
  A flag -Importar é obrigatória para qualquer gravação de dados.
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\testar-overture-local.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\testar-overture-local.ps1 -Importar
#>
[CmdletBinding()]
param(
    [ValidatePattern('^[A-Z]{2}$')]
    [string]$Estado = 'MG',

    [ValidateLength(2, 100)]
    [string]$Cidade = 'Lavras',

    [ValidateRange(1, 100)]
    [int]$Quantidade = 30,

    [switch]$Importar
)

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$pythonVenv = Join-Path $raiz '.venv-overture\Scripts\python.exe'
$stagingUrl = 'https://prlrxjothrslhswpkoza.supabase.co'
$chaveTexto = $null
$segura = $null

Push-Location $raiz
try {
    if (-not (Test-Path 'scripts/import_overture_br.py')) {
        throw 'Importador não encontrado. Abra a pasta correta do projeto Januário Leads.'
    }

    if (-not (Test-Path $pythonVenv)) {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            & py -3 -m venv '.venv-overture'
        } elseif (Get-Command python -ErrorAction SilentlyContinue) {
            & python -m venv '.venv-overture'
        } else {
            throw 'Python 3 não encontrado. Instale Python 3.11+ pelo site python.org e repita.'
        }
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar ambiente Python.' }
    }

    Write-Host 'Instalando dependências somente no ambiente virtual do projeto...'
    & $pythonVenv -m pip install overturemaps geopandas shapely pyogrio
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências do importador.' }

    Write-Host 'Validando o script e os testes offline...'
    & $pythonVenv -m compileall -q scripts/import_overture_br.py
    if ($LASTEXITCODE -ne 0) { throw 'O importador não passou na validação de sintaxe.' }
    & $pythonVenv -m unittest discover -s tests/overture -v
    if ($LASTEXITCODE -ne 0) { throw 'Os testes offline falharam. Nenhuma importação foi feita.' }

    Write-Host "Validando limites municipais: $Cidade / $Estado ..."
    & $pythonVenv scripts/import_overture_br.py --states $Estado --cities $Cidade --max-records-per-state $Quantidade --max-records-per-city $Quantidade --database-max-mb 100 --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'Falha no teste de localização IBGE. Nenhuma importação foi feita.' }

    if (-not $Importar) {
        Write-Host ''
        Write-Host 'Validação concluída. Não foram importadas empresas.'
        Write-Host 'Para testar a importação real em HOMOLOGAÇÃO, repita com -Importar.'
        exit 0
    }

    Write-Host ''
    Write-Host 'Destino FIXO: Supabase HOMOLOGAÇÃO (nunca produção).'
    Write-Host "Lote: até $Quantidade locais em $Cidade / $Estado. Teto total de banco: 100 MB."
    Write-Host 'A chave será usada somente nesta execução e não será salva em arquivo.'
    $segura = Read-Host 'Cole a chave service_role do PROJETO STAGING (entrada oculta)' -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($segura)
    try {
        $chaveTexto = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    if ([string]::IsNullOrWhiteSpace($chaveTexto)) {
        throw 'Chave ausente. Importação cancelada.'
    }
    $env:SUPABASE_URL = $stagingUrl
    $env:SUPABASE_SERVICE_ROLE_KEY = $chaveTexto
    $chaveTexto = $null

    Write-Host 'Baixando a amostra oficial Overture e importando somente os contatos selecionados...'
    & $pythonVenv scripts/import_overture_br.py --states $Estado --cities $Cidade --max-records-per-state $Quantidade --max-records-per-city $Quantidade --database-max-mb 100
    if ($LASTEXITCODE -ne 0) { throw 'Importação não concluída. Verifique as mensagens acima.' }
    Write-Host 'Amostra importada. Veja total e bytes antes/depois no relatório acima.'
} finally {
    Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:\SUPABASE_URL -ErrorAction SilentlyContinue
    $chaveTexto = $null
    $segura = $null
    Pop-Location
}
