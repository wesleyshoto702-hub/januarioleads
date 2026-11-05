#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
unset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
container="januario-baseline-test-$$"
docker_local() { docker --host=unix:///var/run/docker.sock "$@"; }
trap 'docker_local rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker_local run -d --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
# The official Postgres image briefly starts a temporary server during
# initdb, then stops it before bringing up the final server. A single
# pg_isready check can therefore pass just before a restart. Require several
# consecutive SQL connections so the first baseline load is not flaky.
consecutive_ready=0
for attempt in {1..90}; do
  if docker_local exec "$container" psql -X -At -U postgres -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
    consecutive_ready=$((consecutive_ready + 1))
    if (( consecutive_ready >= 4 )); then break; fi
  else
    consecutive_ready=0
  fi
  sleep 1
done
if (( consecutive_ready < 4 )); then
  echo 'PostgreSQL test container did not become consistently ready.' >&2
  exit 1
fi
for sql in supabase/tests/platform-fixture.sql supabase/baseline/20261103-public.sql supabase/tests/baseline.sql supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql supabase/tests/rate-limits.sql; do
  docker_local exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$sql"
done

# Compare only the disposable restored schema catalog to sanitized read-only
# production metadata; no real customer data or remote database connection.
docker_local exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres \
  < supabase/tests/public-schema-inventory-contract.sql

# These read-only release gates must match the production metadata
# fingerprint recorded on 2026-11-05, even in this disposable fixture.
# They never connect to the hosted Supabase project.
check_rls_gate() {
  local file="$1"
  local observed
  observed="$(docker_local exec -i "$container" psql -X -A -t -v ON_ERROR_STOP=1 -U postgres < "$file")"
  if [[ "$observed" != "PASS" ]]; then
    echo "BLOCKED: RLS release gate failed: $file (observed: $observed)" >&2
    exit 1
  fi
  echo "PASS: $file"
}
check_rls_gate docs/proposals/rls-release-policy-preflight-20261105.sql

# Verify the guard actually detects an unexpected permissive policy.
# All changes happen inside a transaction on the disposable database.
drift_result="$(
  {
    printf 'BEGIN;\n'
    printf "CREATE POLICY audit_unexpected_policy ON public.places_search_cache FOR SELECT TO authenticated USING (true);\n"
    cat docs/proposals/rls-release-policy-preflight-20261105.sql
    printf '\nROLLBACK;\n'
  } | docker_local exec -i "$container" psql -X -A -t -v ON_ERROR_STOP=1 -U postgres
)"
if ! grep -qx 'BLOCKED' <<< "$drift_result"; then
  echo "BLOCKED: SQL guard did not detect permissive policy drift" >&2
  exit 1
fi
check_rls_gate docs/proposals/rls-release-policy-preflight-20261105.sql

# The proposed patch remains outside active migrations and runs only in
# the disposable CI container. No write access to production is configured.
for sql in docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt supabase/tests/private-access-revocation-proposal.sql; do
  docker_local exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$sql"
done
check_rls_gate docs/proposals/rls-release-postcheck-20261105.sql
