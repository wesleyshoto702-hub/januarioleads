@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==============================================================
echo JANUARIO LEADS - IMPORTACAO DE TESTE EM HOMOLOGACAO
echo ==============================================================
echo Destino: staging prlrxjothrslhswpkoza (NUNCA producao)
echo Volume: ate 30 locais em Lavras/MG
echo Seu token secreto nao sera salvo em arquivo nem exibido.
echo.
choice /M "Deseja continuar no banco de testes"
if errorlevel 2 exit /b 0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\testar-overture-local.ps1" -Importar
echo.
if errorlevel 1 (
  echo FALHA. Nao publique esta amostra em producao.
) else (
  echo CONCLUIDO. O resumo de armazenamento foi exibido acima.
)
pause
