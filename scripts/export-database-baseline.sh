#!/usr/bin/env bash
set -euo pipefail
# Read-only export; keep connection strings out of output and shell tracing.
: "${SUPABASE_DB_URL:?Configure SUPABASE_DB_URL securely before exporting the baseline}"
command -v supabase >/dev/null
output="${1:-/tmp/januario-public-schema.sql}"
if [[ -e "$output" ]]; then
  echo "Output already exists; choose another path." >&2
  exit 1
fi
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public --file "$output"
echo "Schema exported. Review before committing; this is not an incremental migration."
