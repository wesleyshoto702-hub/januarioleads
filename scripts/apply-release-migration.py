"""Apply only the reviewed incremental fix through Supabase Management API.

SUPABASE_ACCESS_TOKEN must be injected securely. Never accepts arbitrary SQL.
"""
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        sys.exit("SUPABASE_ACCESS_TOKEN is required in GitHub Actions secrets.")
    project = "czkazbianiflhldenhcj"
    migration = Path(__file__).resolve().parents[1] / "supabase/migrations/20261103220000_allow_presence_site_rate_limit.sql"
    request = Request(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        data=json.dumps({"query": migration.read_text()}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=60) as response:
            json.load(response)
    except HTTPError as error:
        sys.exit(f"Migration failed: Management API HTTP {error.code}. No function deployment was started.")
    except (URLError, TimeoutError) as error:
        sys.exit(f"Migration outcome unconfirmed ({type(error).__name__}); inspect the database before retrying.")
    print("Incremental presence_site constraint migration completed.")


if __name__ == "__main__":
    main()
