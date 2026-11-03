"""Read-only checks for two high-impact Supabase security invariants.

No schema changes, no customer data reads, no secret values in logs.
This does not replace a full RLS policy review or end-to-end authentication tests.
"""

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PROJECT_REF = "czkazbianiflhldenhcj"
QUERY = """
SELECT
  NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
  ) AS all_public_tables_rls,
  NOT EXISTS (
    SELECT 1 FROM pg_proc f
    JOIN pg_namespace n ON n.oid = f.pronamespace
    WHERE n.nspname = 'public'
      AND f.prosecdef
      AND (
        has_function_privilege('anon', f.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', f.oid, 'EXECUTE')
      )
  ) AS privileged_rpcs_private;
"""


def check_security():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is required for read-only security verification.")

    request = Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=json.dumps({"query": QUERY}).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=30) as response:
            rows = json.load(response)
    except HTTPError as error:
        sys.exit(f"Cannot verify Supabase security posture: Management API HTTP {error.code}.")
    except (URLError, TimeoutError, ValueError, TypeError):
        sys.exit("Cannot verify Supabase security posture: read-only query failed.")

    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        sys.exit("Cannot verify Supabase security posture: unexpected query response.")

    status = rows[0]
    if status.get("all_public_tables_rls") is not True:
        sys.exit("Security preflight failed: a public table lacks RLS or RLS status is unknown.")
    if status.get("privileged_rpcs_private") is not True:
        sys.exit("Security preflight failed: a SECURITY DEFINER function is executable by clients or status is unknown.")

    print("Read-only Supabase security preflight passed: public RLS and privileged function access.")


if __name__ == "__main__":
    check_security()
