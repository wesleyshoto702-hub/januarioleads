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
        # Show only short, sanitized JSON error details. Never print headers,
        # credentials, arbitrary SQL or opaque bodies returned by the API.
        details = ""
        try:
            payload = json.loads(error.read(4096))
            if isinstance(payload, dict):
                code = payload.get("code") or payload.get("error_code")
                if isinstance(code, str) and len(code) <= 36 and all(
                    c.isalnum() or c in "_-" for c in code
                ):
                    details = f" (error code: {code})"
                message = payload.get("message") or payload.get("error")
                if isinstance(message, str):
                    safe = message.strip()
                    forbidden = ("token", "secret", "password", "authorization", "bearer", "api_key", "apikey")
                    if (len(safe) <= 180 and safe.isprintable()
                            and not any(word in safe.lower() for word in forbidden)
                            and not any(len(word) > 48 for word in safe.split())):
                        details += f" ({safe})"
        except (ValueError, TypeError, UnicodeError):
            pass
        sys.exit(
            f"Migration failed: Management API HTTP {error.code}{details}. "
            "No function deployment was started."
        )
    except (URLError, TimeoutError) as error:
        sys.exit(f"Migration outcome unconfirmed ({type(error).__name__}); inspect the database before retrying.")
    print("Incremental presence_site constraint migration completed.")


if __name__ == "__main__":
    main()
