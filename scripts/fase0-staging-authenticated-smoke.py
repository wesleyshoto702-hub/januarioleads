#!/usr/bin/env python3
"""Read-only authenticated staging smoke test for Januario Leads Phase 0.1.

No service_role or sb_secret key is accepted as a client key.
No customer data or credentials are logged.
Calls only the Overture continuation page, which cannot call paid providers.
The search may atomically consume one *internal* requests-per-user budget slot.
"""
from __future__ import annotations

import base64
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

STAGING_URL = "https://prlrxjothrslhswpkoza.supabase.co"
# Intentionally public sb_publishable_ key; never use a service_role or sb_secret here.
STAGING_PUBLIC_KEY = "sb_publishable_g92A_nFfOkpIQGKaxN8ilg_MJ4-yKpD"
MAX_RESPONSE_BYTES = 128_000

class SmokeError(RuntimeError):
    pass

def require(condition: bool, error: str) -> None:
    if not condition:
        raise SmokeError(error)

def public_key_only(value: str) -> bool:
    if value.startswith("sb_publishable_"):
        return len(value) > len("sb_publishable_")
    if value.startswith("sb_secret_"):
        return False
    # Legacy anon JWT only, never an admin JWT.
    try:
        parts = value.split(".")
        if len(parts) != 3:
            return False
        data = parts[1] + "=" * (-len(parts[1]) % 4)
        claims = json.loads(base64.urlsafe_b64decode(data))
        return isinstance(claims, dict) and claims.get("role") == "anon"
    except (ValueError, TypeError, UnicodeDecodeError, json.JSONDecodeError):
        return False

def signing_algorithm(token: str) -> str:
    """Read only the JWT header to classify the signing algorithm; do not log JWT."""
    try:
        head = token.split(".", 1)[0]
        raw = base64.urlsafe_b64decode(head + "=" * (-len(head) % 4))
        obj = json.loads(raw)
        alg = obj.get("alg")
    except (ValueError, UnicodeDecodeError, TypeError, AttributeError):
        raise SmokeError("Cannot inspect login JWT header") from None
    require(alg in ("HS256", "RS256", "ES256", "EdDSA"),
            "Login JWT used unexpected signing algorithm")
    return str(alg)

def http_json(base: str, key: str, path: str, method: str, payload: dict, token: str | None = None):
    headers = {"apikey": key, "Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    req = Request(base + path, data=json.dumps(payload).encode("utf-8"), method=method, headers=headers)
    try:
        with urlopen(req, timeout=25) as reply:
            status = reply.status
            raw = reply.read(MAX_RESPONSE_BYTES + 1)
    except HTTPError as exc:
        status = exc.code
        raw = exc.read(MAX_RESPONSE_BYTES + 1)
    except (URLError, TimeoutError, OSError) as exc:
        # Avoid printing addresses/tokens/error bodies.
        raise SmokeError("Staging network request failed") from None
    require(len(raw) <= MAX_RESPONSE_BYTES, "Staging response exceeded size limit")
    try:
        return status, json.loads(raw) if raw else None
    except (ValueError, UnicodeDecodeError):
        return status, None

def run(env: dict[str, str]) -> None:
    configured_url = env.get("JANUARIO_STAGING_SUPABASE_URL", "").strip().rstrip("/")
    # Never accept another project; a missing optional URL cannot redirect us.
    require(not configured_url or configured_url == STAGING_URL,
            "Refusing to test: configured staging URL points to another project")
    url = STAGING_URL
    key = env.get("JANUARIO_STAGING_SUPABASE_KEY", "").strip() or STAGING_PUBLIC_KEY
    email = env.get("JANUARIO_STAGING_A_EMAIL", "").strip()
    password = env.get("JANUARIO_STAGING_A_PASSWORD", "")
    require(public_key_only(key), "Staging publishable/anon key not configured or unexpectedly privileged")
    require(urlsplit(url).hostname == "prlrxjothrslhswpkoza.supabase.co", "Non-staging target denied")

    # First ensure unauthenticated functions cannot be used.
    for name, payload in (
        ("search-places", {"mode":"segment-search", "segment":"Restaurante",
                           "city":"Rio de Janeiro", "state":"RJ", "pageToken":"overture:0"}),
        ("staging-plan-preview", {"plan":"invalid-test-plan"}),
    ):
        status, _ = http_json(url, key, "/functions/v1/" + name, "POST", payload)
        require(status == 401, f"{name}: unauthenticated request was not rejected with HTTP 401")
    print("PASS: unauthorized requests rejected by both functions")

    # Neither forged bearer text nor a publishable API key is a user session.
    for bearer in ("invalid-jwt-for-negative-test", key):
        for name, payload in (
            ("search-places", {"mode":"segment-search", "segment":"Restaurante",
                               "city":"Rio de Janeiro", "state":"RJ", "pageToken":"overture:0"}),
            ("staging-plan-preview", {"plan":"invalid-test-plan"}),
        ):
            code, _ = http_json(url, key, "/functions/v1/" + name, "POST", payload, bearer)
            require(code == 401, f"{name}: untrusted bearer unexpectedly reached application")
    print("PASS: malformed bearer and publishable-as-bearer denied by both functions")
    require(email and password, "Staging test account email/password missing from protected secrets")

    # Password grant with a dedicated, allowlisted staging identity only.
    status, login = http_json(url, key, "/auth/v1/token?grant_type=password", "POST",
                              {"email":email, "password":password})
    require(status == 200 and isinstance(login, dict), "Staging test user authentication failed")
    token = login.get("access_token")
    require(isinstance(token, str) and len(token) > 40, "Staging token absent")
    print("PASS: staging user authenticated (no token printed)")
    alg = signing_algorithm(token)
    print("JWT_SIGNING_ALGORITHM: " + alg + " (header only; no token printed)")

    # All seven retired diagnostics/Maps functions are inert (HTTP 410)
    # and their published sources were inspected: no fetch, DB, or paid APIs.
    for slug in (
        "geoapify-personal",
        "geoapify-places",
        "geoapify-name-inspection",
        "google-places-staging-smoke",
        "geoapify-credential-smoke",
        "geoapify-one-shot-inspection",
        "verify-lead-company",
    ):
        code, _ = http_json(url, key, "/functions/v1/" + slug, "POST",
                            {"probe":"jwt-signing-readiness"}, token)
        require(code == 410, f"Retired function {slug} did not respond with HTTP 410")
    print("PASS: seven retired Edge Functions accept signed user JWT but remain HTTP 410")

    # This overture:0 continuation *must* return directly from searchOverture,
    # without executing Geoapify or Google branches (verified in function source).
    status, result = http_json(url, key, "/functions/v1/search-places", "POST", {
        "mode":"segment-search",
        "segment":"Restaurante",
        "city":"Rio de Janeiro", "state":"RJ",
        "pageToken":"overture:0",
    }, token)
    require(status == 200, f"Overture authenticated search returned HTTP {status}, expected 200")
    require(isinstance(result, dict) and result.get("ok") is True,
            "Overture authenticated search did not succeed")
    require(result.get("provider") == "overture", "Overture-only response has unexpected provider")
    require(isinstance(result.get("results"), list), "Overture response lacks results array")
    print("PASS: Overture-only authenticated search; provider=overture; no paid-provider path")

    # Intentional invalid plan is rejected before any subscription writes;
    # function checks SUPABASE_SECRET_KEYS presence before parsing the plan.
    status, preview = http_json(url, key, "/functions/v1/staging-plan-preview",
                                "POST", {"plan":"invalid-test-plan"}, token)
    require(status == 400 and isinstance(preview, dict) and
            preview.get("code") == "INVALID_PLAN",
            "Staging plan preview did not reach its authenticated modern-secret guard")
    print("PASS: plan-preview authorized entry path, invalid plan rejected without mutation")

    print("SUCCESS: Fase 0.1 staging authenticated smoke test passed. No PII or credentials logged.")

if __name__ == "__main__":
    try:
        run(dict(os.environ))
    except SmokeError as exc:
        raise SystemExit("BLOCKED: " + str(exc))
