"""Live two-account RLS test for a *separate* Supabase staging project.

This script creates & removes disposable leads. It hard-fails on any URL
that points to JanuarioLeads production, requires two distinct staging
credentials, and never prints secrets or lead payloads.
"""
from __future__ import annotations
import json
import os
import sys
from datetime import date
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

PROD_PROJECT = "czkazbianiflhldenhcj"


def staging_config(env):
    required = [
        "JANUARIO_STAGING_SUPABASE_URL", "JANUARIO_STAGING_SUPABASE_KEY",
        "JANUARIO_STAGING_A_EMAIL", "JANUARIO_STAGING_A_PASSWORD",
        "JANUARIO_STAGING_B_EMAIL", "JANUARIO_STAGING_B_PASSWORD",
    ]
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise RuntimeError("Staging-only test not configured: missing " + ", ".join(missing))
    value = env["JANUARIO_STAGING_SUPABASE_URL"].strip().rstrip("/")
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https" or not parsed.hostname or parsed.username or
        parsed.password or parsed.port or parsed.path not in ("", "/") or
        parsed.query or parsed.fragment or PROD_PROJECT in parsed.hostname.lower()
    ):
        raise RuntimeError("Unsafe staging URL: HTTPS staging project required; production forbidden")
    if env["JANUARIO_STAGING_A_EMAIL"].strip().lower() == env["JANUARIO_STAGING_B_EMAIL"].strip().lower():
        raise RuntimeError("Two distinct staging test users required")
    return value, env["JANUARIO_STAGING_SUPABASE_KEY"]


def request_json(base, key, method, path, token=None, payload=None, prefer=None):
    headers = {"apikey": key, "Accept": "application/json"}
    if token: headers["Authorization"] = "Bearer " + token
    if payload is not None: headers["Content-Type"] = "application/json"
    if prefer: headers["Prefer"] = prefer
    request = Request(
        base + path, headers=headers, method=method,
        data=json.dumps(payload).encode() if payload is not None else None
    )
    try:
        with urlopen(request, timeout=20) as resp:
            data = resp.read(256_000)
            return resp.status, (json.loads(data) if data else None)
    except HTTPError as exc:
        # Do not log error response bodies — some Auth endpoints echo secrets.
        return exc.code, None
    except (URLError, TimeoutError, ValueError):
        raise RuntimeError("Staging network request failed") from None


def login(base, key, email, password):
    status, result = request_json(
        base, key, "POST", "/auth/v1/token?grant_type=password",
        payload={"email": email, "password": password}
    )
    if status != 200 or not isinstance(result, dict):
        raise RuntimeError("Staging authentication failed")
    token = result.get("access_token")
    user = result.get("user")
    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(token, str) or not isinstance(user_id, str):
        raise RuntimeError("Staging Auth response incomplete")
    return user_id, token


def assert_true(condition, message):
    if not condition: raise RuntimeError(message)


def exercise_staging_rls(env):
    base, key = staging_config(env)
    a, at = login(base, key, env["JANUARIO_STAGING_A_EMAIL"], env["JANUARIO_STAGING_A_PASSWORD"])
    b, bt = login(base, key, env["JANUARIO_STAGING_B_EMAIL"], env["JANUARIO_STAGING_B_PASSWORD"])
    assert_true(a != b, "Staging accounts resolve to the same identity")
    for identity, token in [(a, at), (b, bt)]:
        q = urlencode({"select":"user_id","user_id":"eq."+identity})
        status, data = request_json(base,key,"GET","/rest/v1/private_access?"+q,token)
        assert_true(status==200 and isinstance(data,list) and len(data)==1, "Staging user not allowlisted")
    lead_id_a, lead_id_b = str(uuid4()), str(uuid4())
    created = []
    try:
        for identity, token, lead_id in [(a,at,lead_id_a),(b,bt,lead_id_b)]:
            status,_ = request_json(
                base,key,"POST","/rest/v1/leads",token,
                payload={"id":lead_id,"user_id":identity,"company":"CI-Isolation-Temporary","segment":"CI","first_contact":str(date.today())},
                prefer="return=minimal"
            )
            assert_true(status in (200,201,204), "Staging disposable lead insertion failed")
            created.append((token,lead_id))
        for own, other, token in [(lead_id_a,lead_id_b,at),(lead_id_b,lead_id_a,bt)]:
            status,records = request_json(base,key,"GET","/rest/v1/leads?"+urlencode({"select":"id","id":"in.("+own+","+other+")"}),token)
            assert_true(status==200 and isinstance(records,list) and {x["id"] for x in records}=={own}, "Cross-account lead read detected")
            status,records=request_json(base,key,"PATCH","/rest/v1/leads?"+urlencode({"id":"eq."+other}),token,
                payload={"company":"CrossAccountBlocked"},prefer="return=representation")
            assert_true(status==200 and records==[], "Cross-account lead update allowed")
            status,records=request_json(base,key,"DELETE","/rest/v1/leads?"+urlencode({"id":"eq."+other}),token,
                prefer="return=representation")
            assert_true(status==200 and records==[], "Cross-account lead delete allowed")
        print("Staging two-account PostgREST isolation passed (read/update/delete).")
    finally:
        for token,lead_id in created:
            # Best-effort cleanup; always report cleanup failures.
            status,_=request_json(base,key,"DELETE","/rest/v1/leads?"+urlencode({"id":"eq."+lead_id}),token,prefer="return=minimal")
            if status not in (200,204):
                print("Staging cleanup failed: remove temporary test lead via dashboard",file=sys.stderr)


if __name__=="__main__":
    try: exercise_staging_rls(os.environ)
    except RuntimeError as exc: sys.exit(str(exc))
