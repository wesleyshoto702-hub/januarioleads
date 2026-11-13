#!/usr/bin/env python3
"""Import Overture Places into private Supabase table, scoped to Brazil's municipalities.

Pre-req:
    pip install overturemaps geopandas shapely pyogrio
    export SUPABASE_URL='https://<project>.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='<service role secret>'
    python scripts/import_overture_br.py --states MG,SP --database-max-mb 400

Phase 9 top-up only: requires EXACTLY ONE state and ONE city per run, and
accepts ONLY the staging Supabase project. Read existing IDs first, then insert
ONLY new GERS IDs, without replacing original Overture records. Cap 100 total
per city, stop at 340 MiB and NEVER run from a browser. No automated trigger.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
from urllib import request, error
from urllib.parse import urlparse, urlencode

IBGE_2024_ROOT = (
    "https://geoftp.ibge.gov.br/organizacao_do_territorio/"
    "malhas_territoriais/malhas_municipais/municipio_2024"
)

def state_boundaries_url(state):
    """IBGE offers one ZIP per UF; do not download the 199 MB national file."""
    if state not in STATE_CODES:
        raise ValueError("Invalid Brazilian state code")
    return f"{IBGE_2024_ROOT}/UFs/{state}/{state}_Municipios_2024.zip"

def ensure_state_boundaries(state, source=None):
    if source:
        path = Path(source)
        if not path.is_file():
            raise RuntimeError(f"IBGE boundaries file not found: {path}")
        return path
    path = Path("data/ibge/") / f"{state}_Municipios_2024.zip"
    if not path.is_file():
        path.parent.mkdir(parents=True, exist_ok=True)
        url = state_boundaries_url(state)
        print(f"[{state}] Downloading IBGE municipal boundaries: {url}", flush=True)
        temp = path.with_suffix(".partial")
        try:
            request.urlretrieve(url, temp)
            if temp.stat().st_size < 512:
                raise RuntimeError("IBGE boundaries download appears empty")
            temp.rename(path)
        finally:
            temp.unlink(missing_ok=True)
    return path
STATE_CODES = (
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI "
    "RJ RN RS RO RR SC SP SE TO"
).split()
BATCH_SIZE = 150
STAGING_URL = "https://prlrxjothrslhswpkoza.supabase.co"
TARGET_PER_MUNICIPALITY = 100
STORAGE_STOP_MIB = 340


def normalize(value):
    """Match the TypeScript search adapter's city/name normalization exactly."""
    letters = "".join(
        c for c in unicodedata.normalize("NFD", value.casefold())
        if unicodedata.category(c) != "Mn"
    )
    return " ".join(re.sub(r"[^a-z0-9]+", " ", letters).split())


def first(values):
    return next((v for v in (values or []) if isinstance(v, str) and v.strip()), None)


# A social profile, WhatsApp contact or link shortener is NOT a verified
# business website. This preserves truthful "sem site" prospecting filters.
NON_WEBSITE_HOSTS = frozenset((
    "wa.me", "whatsapp.com", "api.whatsapp.com", "instagram.com",
    "facebook.com", "fb.me", "m.me", "linktr.ee", "linktree.com",
    "bit.ly", "tinyurl.com", "t.co", "youtube.com", "youtu.be",
    "tiktok.com", "x.com", "twitter.com", "maps.google.com",
    "goo.gl", "beacons.ai",
))


def is_business_website(value):
    if not isinstance(value, str):
        return False
    try:
        url = urlparse(value.strip())
        host = (url.hostname or "").lower().removeprefix("www.")
        return (url.scheme in ("http", "https")
                and bool(host) and "." in host
                and host not in NON_WEBSITE_HOSTS
                and not any(host.endswith("." + blocked)
                            for blocked in NON_WEBSITE_HOSTS))
    except ValueError:
        return False


def first_website(values):
    return first([value for value in (values or []) if is_business_website(value)])


def select_diverse_pool(records, maximum):
    """Reserve 40% for contactable companies without identified websites.

    Fill unused slots with the best available business contacts. Never promise
    that a missing website is proof a business actually has no website.
    """
    ranked = sorted(records, key=lead_quality, reverse=True)
    no_site = [r for r in ranked if not r.get("website")
               and (r.get("phone") or r.get("email") or r.get("instagram"))]
    target_no_site = min(len(no_site), (maximum * 2 + 4) // 5)
    chosen = no_site[:target_no_site]
    selected = {r["id"] for r in chosen}
    for row in ranked:
        if len(chosen) >= maximum:
            break
        if row["id"] not in selected:
            chosen.append(row)
            selected.add(row["id"])
    return chosen


def api(base, key, path, method="GET", payload=None, prefer=None):
    data = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    # Legacy service_role JWTs use Authorization; the newer sb_secret_ keys
    # are opaque and must be sent only as apikey, never as Bearer JWT.
    if not (key.startswith("eyJ") or key.startswith("sb_secret_")):
        raise RuntimeError("Use somente a chave secreta de STAGING (sb_secret_ ou service_role legada).")
    headers = {
        "apikey": key,
        "Content-Type": "application/json",
        "Prefer": prefer or "resolution=merge-duplicates,return=minimal",
    }
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    for attempt in range(5):
        try:
            req = request.Request(base + path, method=method, headers=headers, data=data)
            with request.urlopen(req, timeout=45) as resp:
                body = resp.read()
                return json.loads(body) if body else None
        except error.HTTPError as exc:
            detail = exc.read(300).decode("utf-8", errors="replace")
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise RuntimeError(f"Supabase API {exc.code}: {detail}") from exc
        except (error.URLError, TimeoutError):
            if attempt == 4:
                raise
        time.sleep(min(2 ** attempt, 15))
    raise RuntimeError("Unreachable API retry state")


def database_bytes(base, key):
    result = api(base, key, "/rest/v1/rpc/overture_storage_bytes", method="POST", payload={})
    if not isinstance(result, int):
        raise RuntimeError("Storage guard unavailable: run SQL migration first.")
    return result


def existing_city_ids(base, key, state, city_key):
    """Only look up existing GERS IDs; never replace those records."""
    query = urlencode({
        "select": "id", "state": "eq." + state,
        "city_key": "eq." + city_key,
        "limit": str(TARGET_PER_MUNICIPALITY + 1),
    })
    result = api(base, key, "/rest/v1/overture_places?" + query)
    if not isinstance(result, list):
        raise RuntimeError("Supabase did not return the existing city IDs")
    ids = {str(row["id"]) for row in result if isinstance(row, dict) and row.get("id")}
    if len(result) > TARGET_PER_MUNICIPALITY:
        raise RuntimeError("City already exceeds 100 places. Stop and review.")
    return ids


def only_new_within_cap(ranked, existing_ids, cap=TARGET_PER_MUNICIPALITY):
    """Append only unrecorded IDs, never allowing more than 100 total."""
    room = max(0, cap - len(existing_ids))
    if room == 0:
        return []
    selected, seen = [], set(existing_ids)
    for row in ranked:
        identifier = row.get("id")
        if not identifier or identifier in seen:
            continue
        seen.add(identifier)
        selected.append(row)
        if len(selected) >= room:
            break
    return selected


def status(base, key, state, phase, count=0, message=None):
    api(base, key, "/rest/v1/overture_import_progress?on_conflict=state", "POST", [{
        "state": state, "status": phase,
        "imported_rows": count, "last_error": message,
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }])


def municipalities_index(boundaries):
    import geopandas as gpd

    frame = gpd.read_file("zip://" + str(boundaries.resolve()))
    if frame.crs is None:
        raise RuntimeError("The IBGE municipal boundary file has no CRS.")
    frame = frame.to_crs(epsg=4326).reset_index(drop=True)
    columns = set(frame.columns)
    if not {"NM_MUN", "SIGLA_UF"}.issubset(columns):
        raise RuntimeError(f"Unexpected IBGE municipalities columns: {sorted(columns)}")
    frame = frame[frame["SIGLA_UF"].isin(STATE_CODES)].copy().reset_index(drop=True)
    return frame


def place_record(feature, municipalities, state):
    from shapely.geometry import Point

    props = feature.get("properties") or {}
    coords = (feature.get("geometry") or {}).get("coordinates") or []
    if len(coords) != 2:
        return None
    lon, lat = coords
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return None
    name = (props.get("names") or {}).get("primary")
    # GeoJSON exporters may place the Overture GERS id in Feature.id rather
    # than properties.id. Preserve either representation.
    identifier = props.get("id") or feature.get("id")
    if not isinstance(name, str) or not name.strip() or not isinstance(identifier, str):
        return None
    if props.get("operating_status") == "permanently_closed":
        return None

    # State bounding boxes overlap: map point to the true municipality.
    point = Point(lon, lat)
    matches = municipalities.sindex.query(point, predicate="intersects")
    if len(matches) == 0:
        return None
    mun = municipalities.iloc[int(matches[0])]
    if mun["SIGLA_UF"] != state:
        return None
    address = (props.get("addresses") or [{}])[0]
    if not isinstance(address, dict):
        address = {}
    taxonomy = props.get("taxonomy") or {}
    confidence = props.get("confidence")
    socials = props.get("socials") or []
    websites = props.get("websites") or []
    instagram = first([s for s in (socials + websites)
                       if isinstance(s, str) and
                       re.search(r"https?://(?:www\.)?instagram\.com/", s, re.I)])
    return {
        "id": identifier[:100],
        "name": name.strip()[:240],
        "name_key": normalize(name)[:240],
        "category": str(taxonomy.get("primary") or props.get("basic_category") or "")[:120] or None,
        "city": str(mun["NM_MUN"])[:120],
        "city_key": normalize(str(mun["NM_MUN"]))[:120],
        "state": str(mun["SIGLA_UF"]),
        "address": str(address.get("freeform") or "")[:400] or None,
        "latitude": lat, "longitude": lon,
        "phone": (first(props.get("phones")) or "")[:80] or None,
        "email": (first(props.get("emails")) or "")[:200] or None,
        "website": (first_website(websites) or "")[:500] or None,
        "instagram": instagram[:500] if instagram else None,
        "confidence": confidence if isinstance(confidence, (int, float)) else None,
        "operating_status": str(props.get("operating_status") or "")[:35] or None,
        "data_release": os.getenv("OVERTURE_DATA_RELEASE", "latest")[:80],
    }


def lead_quality(row):
    """Prioritize genuine, contactable establishments within the per-city quota."""
    confidence = row.get("confidence")
    weight = float(confidence) * 5 if isinstance(confidence, (int, float)) else 0
    return (weight
            + 12 * bool(row.get("phone"))
            + 11 * bool(row.get("email"))
            + 7 * bool(row.get("website"))
            + 3 * bool(row.get("instagram"))
            + 2 * bool(row.get("category")))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states", default=",".join(STATE_CODES),
                        help="Comma-separated UF codes; default all 27")
    parser.add_argument("--cities", default="",
                        help="Optional comma-separated cities, requires exactly one UF; useful for a small pilot")
    parser.add_argument("--boundaries", default=None,
                        help="Optional existing ZIP; defaults to one IBGE ZIP per UF")
    parser.add_argument("--database-max-mb", type=int, default=STORAGE_STOP_MIB)
    parser.add_argument("--max-records-per-state", type=int, default=0,
                        help="0=no state cap; nonzero limits state rows and marks coverage partial")
    parser.add_argument("--max-records-per-city", type=int, default=TARGET_PER_MUNICIPALITY,
                        help="Final maximum per municipality: always 100")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 30 <= args.database_max_mb <= STORAGE_STOP_MIB:
        parser.error("--database-max-mb must be <= 340 MiB for the top-up pipeline")
    if args.max_records_per_state < 0:
        parser.error("--max-records-per-state cannot be negative")
    if args.max_records_per_city != TARGET_PER_MUNICIPALITY:
        parser.error("--max-records-per-city must be exactly 100 for this phase")
    states = [s.strip().upper() for s in args.states.split(",")]
    if not states or len(set(states)) != len(states) or any(s not in STATE_CODES for s in states):
        parser.error("--states must contain unique Brazilian UF codes")
    cities = [normalize(s.strip()) for s in args.cities.split(",") if s.strip()]
    if len(states) != 1 or len(cities) != 1:
        parser.error("Phase 9 processes exactly one municipality from one state per run")

    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not args.dry_run and (base != STAGING_URL or not key):
        parser.error("Phase 9 accepts ONLY the Januário Leads staging URL and a secret")

    limit_bytes = args.database_max_mb * 1024 * 1024
    for state in states:
        # Individual state archive keeps network and runner-memory use modest.
        boundaries = ensure_state_boundaries(state, args.boundaries)
        municipalities = municipalities_index(boundaries)
        state_munis = municipalities.loc[municipalities.SIGLA_UF == state].copy()
        if cities:
            state_munis = state_munis.loc[
                state_munis.NM_MUN.map(lambda name: normalize(str(name)) in cities)
            ].copy()
            found_cities = {normalize(str(name)) for name in state_munis.NM_MUN}
            if set(cities) != found_cities:
                raise RuntimeError(f"Municipality not found in {state}: {sorted(set(cities) - found_cities)}")
        if state_munis.empty:
            raise RuntimeError(f"IBGE archive does not cover {state}")
        west, south, east, north = state_munis.total_bounds
        # Slightly wider rectangle avoids border rounding gaps.
        bbox = ",".join(f"{v:.6f}" for v in (west - .005, south - .005, east + .005, north + .005))
        print(f"[{state}] Overture bbox {bbox}", flush=True)
        if args.dry_run:
            continue
        storage_before = database_bytes(base, key)
        existing_ids = existing_city_ids(base, key, state, cities[0])
        if len(existing_ids) >= TARGET_PER_MUNICIPALITY:
            print(f"ALREADY_COMPLETE: {state}/{cities[0]} has {len(existing_ids)} existing companies.", flush=True)
            return 0
        print(f"TOP_UP: {state}/{cities[0]} existing={len(existing_ids)}, capacity={TARGET_PER_MUNICIPALITY-len(existing_ids)}.", flush=True)
        if storage_before >= limit_bytes:
            print(f"STOP: database reached configured {args.database_max_mb} MB safety limit.")
            return 2
        total = 0
        status(base, key, state, "running")
        try:
            with tempfile.TemporaryDirectory(prefix="overture-br-") as temp:
                out = Path(temp) / f"{state}.geojsonseq"
                subprocess.run(["overturemaps", "download", f"--bbox={bbox}",
                                "--type=place", "-f", "geojsonseq", "-o", str(out)],
                               check=True)
                # Store only a small, quality-ranked per-city selection in memory.
                city_records = {}
                city_capped = False
                with out.open("r", encoding="utf-8") as src:
                    for line in src:
                        line = line.lstrip("\x1e").strip()
                        if not line:
                            continue
                        row = place_record(json.loads(line), state_munis, state)
                        if row is None:
                            continue
                        # Keep two bounded quality pools per municipality.
                        # Otherwise the top 30 are almost always ALL "with site".
                        groups = city_records.setdefault(row["city_key"], {
                            "with_site": [], "without_site": [],
                        })
                        pool = groups["with_site" if row.get("website") else "without_site"]
                        if len(pool) < args.max_records_per_city:
                            pool.append(row)
                        else:
                            city_capped = True
                            worst = min(range(len(pool)),
                                        key=lambda idx: lead_quality(pool[idx]))
                            if lead_quality(row) > lead_quality(pool[worst]):
                                pool[worst] = row

                # Interleave municipality samples for nationwide fair coverage.
                ranked_cities = {
                    city: select_diverse_pool(groups["with_site"] + groups["without_site"],
                                              args.max_records_per_city)
                    for city, groups in city_records.items()
                }
                selected = []
                for rank in range(args.max_records_per_city):
                    for city in sorted(ranked_cities):
                        pool = ranked_cities[city]
                        if rank < len(pool):
                            selected.append(pool[rank])

                selected = only_new_within_cap(selected, existing_ids)
                if not selected:
                    print(f"NO_NEW_PLACES: {state}/{cities[0]} has no additional eligible Overture companies.", flush=True)
                    return 0
                # A municipality-only pilot never marks the whole state as imported.
                partial = city_capped or bool(cities)
                if args.max_records_per_state and len(selected) > args.max_records_per_state:
                    selected = selected[:args.max_records_per_state]
                    partial = True
                for start in range(0, len(selected), BATCH_SIZE):
                    if database_bytes(base, key) >= limit_bytes:
                        partial = True
                        break
                    batch = selected[start:start + BATCH_SIZE]
                    api(base, key, "/rest/v1/overture_places?on_conflict=id", "POST", batch,
                        prefer="resolution=ignore-duplicates,return=minimal")
                    total += len(batch)
                storage_after = database_bytes(base, key)
                status(base, key, state, "partial" if partial else "complete", total)
                delta = storage_after - storage_before
                bytes_per_imported_row = delta // total if total else 0
                print(f"[{state}] {total} imported; "
                      f"database before={storage_before}, after={storage_after}, "
                      f"delta={delta}, average={bytes_per_imported_row} B/row; "
                      f"{'PARTIAL' if partial else 'COMPLETE'}", flush=True)
                if storage_after >= limit_bytes:
                    print("STOP: database safety threshold; remaining states NOT imported.", flush=True)
                    return 2
        except Exception as exc:
            status(base, key, state, "error", total, str(exc)[:200])
            raise
    print("Ingestion pass ended. Check overture_import_progress for coverage.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
