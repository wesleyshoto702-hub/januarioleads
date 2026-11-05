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

# Test the actual revocation gap FIRST in the historical baseline. Then
# harden it, test two fictional tenants, restore original policies (emergency
# rollback), demonstrate the gap returns, and reapply the candidate to prove
# a repeatable forward repair. All database operations are inside the
# throwaway postgres:17 container created above. NEVER run on production.
for sql in \
  supabase/tests/private-access-revocation-before.sql \
  docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt \
  supabase/tests/private-access-revocation-proposal.sql \
  docs/proposals/private-access-revocation-rollback-2026-11-05.sql.txt \
  supabase/tests/private-access-revocation-before.sql \
  docs/proposals/private-access-revocation-policies-2026-11-05.sql.txt \
  supabase/tests/private-access-revocation-proposal.sql; do
  docker_local exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres < "$sql"
done
