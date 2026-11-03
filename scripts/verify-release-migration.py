"""Read-only production preflight for the already-applied presence_site migration.

GitHub's Supabase Management API token runs SQL in a read-only transaction.
DDL must instead be applied by an authorized database migration mechanism.
Do not attempt ALTER TABLE in this workflow.
"""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PROJECT_REF = "czkazbianiflhldenhcj"
QUERY = """
SELECT c.convalidated
       AND position('presence_site' in pg_get_constraintdef(c.oid)) > 0 AS applied
FROM pg_constraint AS c
JOIN pg_class AS t ON t.oid = c.conrelid
JOIN pg_namespace AS n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'api_request_rate_limit'
  AND c.conname = 'api_request_rate_limit_bucket_check';
"""


def main():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is required in GitHub Actions secrets.")

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
        # Never log tokens, headers, arbitrary API responses or SQL payloads.
        sys.exit(f"Cannot verify presence_site migration: Management API HTTP {error.code}.")
    except (URLError, TimeoutError, ValueError, TypeError):
        sys.exit("Cannot verify presence_site migration: query failed or response invalid.")

    if (not isinstance(rows, list) or len(rows) != 1
            or not isinstance(rows[0], dict) or rows[0].get("applied") is not True):
        sys.exit(
            "Production is missing the presence_site CHECK constraint. "
            "Apply the reviewed migration using an authorized database connection "
            "before deploying functions."
        )

    print("Verified presence_site CHECK constraint in production (read-only preflight).")


if __name__ == "__main__":
    main()
