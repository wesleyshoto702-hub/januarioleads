#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
container="januario-baseline-test-$$"
docker_local() { docker --host=unix:///var/run/docker.sock "$@"; }
trap 'docker_local rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker_local run -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
for attempt in {1..60}; do
  if docker_local exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
for sql in supabase/tests/platform-fixture.sql supabase/baseline/20261103-public.sql supabase/tests/baseline.sql supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql supabase/tests/rate-limits.sql; do
  docker_local exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$sql"
done
