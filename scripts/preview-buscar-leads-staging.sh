#!/usr/bin/env bash
# Local staging-only preview of unified Buscar Leads (Overture > Geoapify > Google).
# Run under WSL/Linux from any working directory.
# Public publishable key only; NEVER use service_role, sb_secret or production credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

export VITE_DEPLOY_TARGET=staging
export VITE_HTTPONLY_SESSION=false
export VITE_SUPABASE_URL=https://prlrxjothrslhswpkoza.supabase.co
export VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_g92A_nFfOkpIQGKaxN8ilg_MJ4-yKpD

if [[ ! -f package.json || ! -f supabase/functions/_shared/overture-search.ts ]]; then
  echo "ERRO: use a branch feat/overture-brasil-nacional completa, nao main." >&2
  exit 1
fi
if [[ "$VITE_SUPABASE_URL" != "https://prlrxjothrslhswpkoza.supabase.co" ]]; then
  echo "ERRO: a URL do banco nao corresponde ao staging." >&2
  exit 1
fi

echo "Januario Leads - PREVIEW LOCAL ISOLADO DO STAGING"
echo "Supabase staging: prlrxjothrslhswpkoza"
echo "Todos os logins e buscas neste preview usam o Supabase de testes."
echo "Nao cole chave service_role: ela nao e usada aqui."
echo "Abrir no navegador a URL localhost exibida pelo servidor."
echo ""

if command -v bun >/dev/null 2>&1; then
  if [[ ! -d node_modules ]]; then
    echo "Instalando dependencias pelo bun.lock (primeira execucao)..."
    bun install --frozen-lockfile
  fi
  exec bun run dev --host 127.0.0.1
elif command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [[ "$NODE_MAJOR" -lt 22 ]]; then
    echo "ERRO: Node.js $NODE_MAJOR antigo. Instale Node.js 22+ ou Bun no WSL." >&2
    exit 1
  fi
  if [[ ! -d node_modules ]]; then
    echo "Instalando dependencias pelo npm (primeira execucao)..."
    npm install --no-audit --no-fund
  fi
  exec npm run dev -- --host 127.0.0.1
else
  echo "ERRO: instale Bun ou Node.js 22+ no Ubuntu antes de iniciar a preview." >&2
  exit 1
fi
