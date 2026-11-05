#!/usr/bin/env python3
"""Ephemeral Supabase Auth + PostgREST integration test for Januario Leads.

NEVER targets a hosted Supabase project. Requires a local CLI stack bound to
127.0.0.1, a fresh database container and test-only identities. Does NOT
connect to production, obtain remote credentials or invoke Google/OpenAI APIs.

Usage (only inside the isolated GitHub Actions runner):
  python3 scripts/validate_supabase_auth_staging.py \
      --stack-dir "$RUNNER_TEMP/januario-supabase-staging" \
      --candidate path/to/reviewed/rls-policy.sql.txt
"""
from __future__ import annotations

import argparse
import json
import re
import secrets
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VALID_UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
ALLOWED_URL = re.compile(r"^http://(?:127\.0\.0\.1|localhost):[0-9]{2,5}$")


class IntegrationFailure(RuntimeError):
    pass


def require(test: bool, message: str) -> None:
    if not test:
        raise IntegrationFailure(message)


def run(*args: str, cwd: Path | None = None, data: str | None = None) -> str:
    r = subprocess.run(args, cwd=cwd, input=data, capture_output=True, text=True)
    if r.returncode:
        # Do not print stdout/stderr: CLI status can contain temporary JWTs.
        raise IntegrationFailure(f"Local command failed: {args[0]} (exit {r.returncode})")
    return r.stdout


def local_status(stack_dir: Path) -> dict[str, str]:
    lines = run("supabase", "status", "-o", "env", cwd=stack_dir).splitlines()
    env = {}
    for line in lines:
        if "=" in line:
            key, value = line.strip().split("=", 1)
            env[key] = value.strip('"').strip("'")
    url = env.get("API_URL", "").rstrip("/")
    require(ALLOWED_URL.fullmatch(url) is not None,
            "Refusing anything except an isolated loopback Supabase API URL")
    require(env.get("ANON_KEY") or env.get("PUBLISHABLE_KEY"), "Local anon API key absent")
    require(env.get("SERVICE_ROLE_KEY") or env.get("SECRET_KEY"), "Local service API key absent")
    return env


def find_local_db() -> str:
    containers = run("docker", "ps", "--format", "{{.Names}}").splitlines()
    candidates = [name for name in containers if name.startswith("supabase_db_")]
    require(len(candidates) == 1,
            "Expected exactly one local Supabase postgres container; aborting for safety")
    return candidates[0]


def psql(container: str, sql: str) -> None:
    r = subprocess.run(
        ["docker", "exec", "-i", container, "psql", "-X", "-q",
         "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
        input=sql, capture_output=True, text=True
    )
    if r.returncode != 0:
        # No secrets in locally supplied SQL, but suppress payloads anyway.
        detail = r.stderr.strip().splitlines()[-1] if r.stderr.strip() else "SQL error"
        raise IntegrationFailure(f"Isolated PostgreSQL operation failed: {detail[:180]}")


def quote_uuid(value: str) -> str:
    require(VALID_UUID.fullmatch(value) is not None, "Unexpected user UUID")
    return "'" + value + "'"


def make_client(api_url: str, anon: str):
    def request(method: str, path: str, body=None, token: str | None = None,
                key: str | None = None) -> tuple[int, object]:
        payload = json.dumps(body).encode() if body is not None else None
        headers = {
            "apikey": key or anon,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Prefer": "return=representation",
        }
        if token:
            headers["Authorization"] = "Bearer " + token
        req = urllib.request.Request(
            api_url + path, data=payload, method=method, headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                status = response.status
                raw = response.read()
        except urllib.error.HTTPError as err:
            status = err.code
            raw = err.read()
        except urllib.error.URLError:
            raise IntegrationFailure("Loopback Auth/PostgREST endpoint unavailable") from None
        try:
            parsed = json.loads(raw) if raw else None
        except (ValueError, UnicodeDecodeError):
            parsed = None
        return status, parsed
    return request


def expect_rows(request, resource: str, token: str, expected: int,
                service: str | None = None) -> list:
    status, data = request("GET", f"/rest/v1/{resource}?select=*", token=token,
                           key=service)
    require(status == 200 and isinstance(data, list), f"{resource}: read failed ({status})")
    require(len(data) == expected,
            f"{resource}: expected {expected} visible records, got {len(data)}")
    return data


def require_insert(request, resource: str, token: str, payload: dict) -> dict:
    status, data = request("POST", f"/rest/v1/{resource}?select=*", body=payload,
                           token=token)
    require(status in (200, 201) and isinstance(data, list) and len(data) == 1,
            f"{resource}: authorized insert failed ({status})")
    return data[0]


def expect_denied_insert(request, resource: str, token: str, payload: dict) -> None:
    status, _ = request("POST", f"/rest/v1/{resource}", body=payload, token=token)
    require(status in (401, 403), f"{resource}: invalid insert unexpectedly accepted ({status})")


def signup(request) -> tuple[str, str]:
    email = f"januario-rls-audit-{uuid.uuid4().hex[:16]}@example.com"
    password = "Audit#" + secrets.token_urlsafe(22)
    status, data = request("POST", "/auth/v1/signup",
                           body={"email": email, "password": password})
    require(status in (200, 201) and isinstance(data, dict),
            f"Local GoTrue signup failed ({status})")
    token = data.get("access_token")
    user = data.get("user") or {}
    if not token:
        # Local Auth may require a password grant despite signup succeeding.
        status, signed = request("POST", "/auth/v1/token?grant_type=password",
                                  body={"email": email, "password": password})
        require(status == 200 and isinstance(signed, dict),
                "GoTrue did not grant a confirmed test session")
        token = signed.get("access_token")
        user = signed.get("user") or user
    require(isinstance(token, str) and len(token) > 100,
            "Expected real GoTrue-signed JWT")
    uid = user.get("id")
    require(isinstance(uid, str) and VALID_UUID.fullmatch(uid) is not None,
            "GoTrue did not return a valid user ID")
    return uid, token


def cache_row(user_id: str, key: str) -> dict:
    return {
        "user_id": user_id,
        "location_key": key,
        "city": "Lavras",
        "state": "MG",
        "segment": "Restaurante",
        "results": [],
    }


def validate(stack: Path, candidate: Path) -> None:
    require(stack.resolve() != REPO.resolve(),
            "Must use an isolated temporary Supabase project, never the production checkout")
    require(candidate.is_file(), "Reviewed policy proposal missing")
    policy = candidate.read_text(encoding="utf-8")
    require("set local lock_timeout" in policy.lower() and
            "private_access pa" in policy and
            "rollback" not in candidate.name.lower(),
            "Policy candidate lacks reviewed safeguards")
    status = local_status(stack)
    api_url = status["API_URL"].rstrip("/")
    anon = status.get("ANON_KEY") or status["PUBLISHABLE_KEY"]
    service = status.get("SERVICE_ROLE_KEY") or status.get("SECRET_KEY")
    request = make_client(api_url, anon)
    container = find_local_db()

    # These are genuine GoTrue Auth signups, not fabricated JWT claims.
    a, ta = signup(request)
    b, tb = signup(request)
    c, tc = signup(request)
    require(len({a, b, c}) == 3, "Not three distinct test identities")
    print("PASS: three isolated users signed up through local GoTrue.")

    psql(container, (REPO / "supabase/baseline/20261103-public.sql").read_text())
    psql(container, (REPO / "supabase/migrations/"
                     "20261103220000_allow_presence_site_rate_limit.sql").read_text())
    print("PASS: public schema baseline + approved presence_site delta loaded locally.")

    psql(container, "INSERT INTO public.private_access(user_id) VALUES "
         f"({quote_uuid(a)}),({quote_uuid(b)});")
    la = require_insert(request, "leads", ta, {
        "user_id": a, "company": "Staging restaurant A", "segment": "Teste",
        "first_contact": "2026-11-05",
    })["id"]
    lb = require_insert(request, "leads", tb, {
        "user_id": b, "company": "Staging restaurant B", "segment": "Teste",
        "first_contact": "2026-11-05",
    })["id"]
    require_insert(request, "lead_payments", ta, {
        "lead_id": la, "user_id": a, "amount": 10, "payment_method": "pix",
    })
    require_insert(request, "lead_payments", tb, {
        "lead_id": lb, "user_id": b, "amount": 20, "payment_method": "pix",
    })
    require_insert(request, "places_search_cache", ta, cache_row(a, "staging-a|mg"))
    require_insert(request, "places_search_cache", tb, cache_row(b, "staging-b|mg"))

    psql(container,
         "INSERT INTO public.open_now_niche_cache(user_id,location_key,city,state,"
         "segment,family) VALUES "
         f"({quote_uuid(a)},'staging-a|mg','Lavras','MG','Restaurante','Alimentação'),"
         f"({quote_uuid(b)},'staging-b|mg','Lavras','MG','Restaurante','Alimentação');")

    for resource in ("leads", "lead_payments", "places_search_cache",
                     "open_now_niche_cache"):
        expect_rows(request, resource, ta, 1)
        expect_rows(request, resource, tb, 1)
        expect_rows(request, resource, tc, 0)
    expect_denied_insert(request, "places_search_cache", tb,
                         cache_row(a, "cross-tenant|mg"))
    print("PASS: RLS ownership, cross-tenant isolation and never-authorized user.")

    # Demonstrate vulnerability in original schema through *real* JWT REST.
    psql(container, f"DELETE FROM public.private_access WHERE user_id={quote_uuid(a)};")
    expect_rows(request, "leads", ta, 0)
    for resource in ("lead_payments", "places_search_cache", "open_now_niche_cache"):
        expect_rows(request, resource, ta, 1)
    print("PASS: original revoked-JWT access gap reproduced via real PostgREST.")

    # Regrant A, apply the reviewed proposal from the separate, pinned PR #36.
    psql(container, f"INSERT INTO public.private_access(user_id) VALUES ({quote_uuid(a)});")
    psql(container, policy)
    psql(container, f"DELETE FROM public.private_access WHERE user_id={quote_uuid(a)};")

    for resource in ("leads", "lead_payments", "places_search_cache",
                     "open_now_niche_cache"):
        expect_rows(request, resource, ta, 0)
        expect_rows(request, resource, tb, 1)
        expect_rows(request, resource, tc, 0)
    expect_denied_insert(request, "places_search_cache", ta,
                         cache_row(a, "revoked|mg"))
    expect_denied_insert(request, "places_search_cache", tc,
                         cache_row(c, "never-allowed|mg"))
    result_code, data = request(
        "PATCH", "/rest/v1/places_search_cache?location_key=eq.staging-a%7Cmg",
        body={"page_count": 3}, token=ta
    )
    require(result_code in (200, 204) and (data in (None, []) or data == {}),
            "Revoked account could change visible cached search")
    expect_rows(request, "lead_payments", service, 2, service=service)
    print("PASS: patched RLS blocks revoked JWT and preserves B and admin access.")

    # The same signed token must regain access to the original rows without
    # deleting data or issuing a new session.
    psql(container, f"INSERT INTO public.private_access(user_id) VALUES ({quote_uuid(a)});")
    for resource in ("leads", "lead_payments", "places_search_cache",
                     "open_now_niche_cache"):
        expect_rows(request, resource, ta, 1)
        expect_rows(request, resource, tb, 1)
    status_code, _ = request("GET", "/rest/v1/lead_payments?select=id",
                             token="invalid-local-jwt")
    require(status_code in (401, 403), "PostgREST accepted an invalid JWT")
    print("PASS: same GoTrue token reauthorized; invalid JWT refused.")
    print("PASS: complete temporary Supabase Auth/PostgREST staging contract.")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--stack-dir", type=Path, required=True)
    p.add_argument("--candidate", type=Path, required=True)
    args = p.parse_args()
    try:
        validate(args.stack_dir, args.candidate)
    except IntegrationFailure as exc:
        print(f"STAGING VALIDATION FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
