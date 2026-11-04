"""No-secrets live CORS smoke test for JanuarioLeads Edge Functions.
OPTIONS preflights must accept the published and preview origins, and reject
an unrelated origin without echoing it in Access-Control-Allow-Origin.
"""
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://czkazbianiflhldenhcj.supabase.co/functions/v1"
SLUGS = ("search-places", "deep-enrich-business")
ORIGINS = (
    "https://januleads.vercel.app",
    "https://lovable.dev",
    "https://preview.lovable.dev",
    "https://preview.lovable.app",
)


def check_preflight(slug, origin, should_allow=True, opener=urlopen):
    if slug not in SLUGS:
        raise ValueError("Unrecognized Edge Function")
    request = Request(
        BASE + "/" + slug,
        method="OPTIONS",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,apikey",
        },
    )
    try:
        with opener(request, timeout=15) as response:
            status, headers = response.status, response.headers
    except HTTPError as error:
        status, headers = error.code, error.headers
    except (URLError, TimeoutError):
        raise RuntimeError("Cannot reach Supabase Edge Functions") from None

    returned_origin = headers.get("Access-Control-Allow-Origin")
    if should_allow:
        if status != 204 or returned_origin != origin:
            raise RuntimeError(
                f"Preflight failed for {slug}: HTTP {status}, "
                "origin not explicitly allowed"
            )
        if "POST" not in (headers.get("Access-Control-Allow-Methods") or ""):
            raise RuntimeError(f"POST method not allowed for {slug}")
        if "Origin" not in (headers.get("Vary") or ""):
            raise RuntimeError(f"Missing Vary: Origin for {slug}")
    elif status != 403 or returned_origin == origin:
        raise RuntimeError(f"Untrusted browser origin accepted by {slug}")
    return True


def main():
    for slug in SLUGS:
        for origin in ORIGINS:
            check_preflight(slug, origin)
        check_preflight(slug, "https://attacker.example", False)
    print("CORS preflight passed for both Edge Functions and all approved app hosts.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        sys.exit(str(error))
