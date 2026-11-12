@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ==============================================================
echo JANUARIO LEADS - TESTE LOCAL OVERTURE (SEM GITHUB ACTIONS)
echo ==============================================================
echo Nenhum dado sera enviado ao Supabase nesta etapa.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\testar-overture-local.ps1"
echo.
if errorlevel 1 (
  echo FALHA. Copie somente o texto do erro, nunca suas credenciais.
) else (
  echo CONCLUIDO. Para o piloto real, use IMPORTAR-OVERTURE-STAGING.cmd.
)
pause
