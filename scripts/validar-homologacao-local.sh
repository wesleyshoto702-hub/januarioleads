#!/usr/bin/env bash
# JanuárioLeads: run local checks only. NEVER deploys to Vercel or production.
set -Eeuo pipefail

STAGING_URL="https://prlrxjothrslhswpkoza.supabase.co"
if [[ "${VITE_SUPABASE_URL:-}" != "$STAGING_URL" ]]; then
  echo "ERRO: defina VITE_SUPABASE_URL com o endereço EXATO do Supabase Staging." >&2
  exit 2
fi
if [[ "${CONFIRMAR_EXECUCAO_LOCAL:-}" != "SIM" ]]; then
  echo "ERRO: defina CONFIRMAR_EXECUCAO_LOCAL=SIM antes de executar testes." >&2
  exit 2
fi
if [[ ! -f package.json || ! -f package-lock.json ]]; then
  echo "ERRO: execute na raiz de um checkout do JanuárioLeads." >&2
  exit 2
fi
for command in npm node deno; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERRO: comando ausente: $command" >&2
    exit 2
  fi
done
if [[ ! -d node_modules ]]; then
  echo "ERRO: dependências ausentes. Faça npm ci em ambiente controlado e repita." >&2
  exit 2
fi

echo "Verificando TypeScript, lint, testes Deno e build LOCAL..."
npm run typecheck
npm run lint
npm test
npm run build

if [[ "${EXECUTAR_TESTES_BROWSER:-NAO}" == "SIM" ]]; then
  echo "Rodando Playwright. Verifique os mocks/URLs e chaves de staging."
  npm run test:browser
else
  echo "Playwright NÃO executado. Para habilitar, defina EXECUTAR_TESTES_BROWSER=SIM."
fi

echo "Concluído: relatórios locais disponíveis. Nenhum deploy executado."
