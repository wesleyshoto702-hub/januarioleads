#!/usr/bin/env python3
"""Import Overture Places into private Supabase table, scoped to Brazil's municipalities.

Pre-req:
    pip install overturemaps geopandas shapely pyogrio
    export SUPABASE_URL='https://<project>.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='<service role secret>'
    python scripts/expand_overture_to_100_staging.py --states MG --cities Lavras --database-max-mb 340

Phase 9 top-up (staging only): accepts one state and 1-3 NEARBY cities per download.
All results are scanned; original GERS IDs/names remain unchanged. Only new rows
are inserted up to 100 companies per municipality, stopping at 340 MiB. A
geographic bounding-box safety guard prevents oversized batched queries.
No automatic imports and no browser-side secrets.
"""
import argparse
import json
import math
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
# Suppress named geographical features that are not potential companies.
NON_LEAD_CATEGORIES = frozenset((
    "river", "lake", "stream", "waterfall", "mountain", "cave",
    "island", "pond", "reservoir", "forest", "wetland", "beach",
    "city", "town", "village", "municipality", "county", "state",
    "country", "natural_feature", "neighborhood", "locality",
))

def is_lead_candidate(row):
    return bool(row.get("name") and
                (row.get("category") or "").lower() not in NON_LEAD_CATEGORIES)


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


def existing_city_places(base, key, state, city_key):
    """Read the already imported businesses of one municipality (max 100)."""
    query = urlencode({
        "select": "id,name,name_key,latitude,longitude",
        "state": "eq." + state, "city_key": "eq." + city_key,
        "limit": str(TARGET_PER_MUNICIPALITY + 1),
    })
    result = api(base, key, "/rest/v1/overture_places?" + query)
    if not isinstance(result, list):
        raise RuntimeError("Supabase did not return existing city businesses")
    if len(result) > TARGET_PER_MUNICIPALITY:
        raise RuntimeError("Municipality exceeds 100 entries. Investigate before continuing.")
    return result


def same_business(a, b, meters=15.0):
    """Conservative alias check: EXACT normalized name AND location within 15m."""
    name_a = str(a.get("name_key") or normalize(a.get("name") or ""))
    name_b = str(b.get("name_key") or normalize(b.get("name") or ""))
    if not name_a or name_a != name_b:
        return False
    try:
        la1, lo1 = float(a["latitude"]), float(a["longitude"])
        la2, lo2 = float(b["latitude"]), float(b["longitude"])
        if not all(math.isfinite(x) for x in (la1, lo1, la2, lo2)):
            return False
        x1, x2, delta_lon = math.radians(la1), math.radians(la2), math.radians(lo2-lo1)
        delta_lat = x2-x1
        value = math.sin(delta_lat/2)**2 + math.cos(x1)*math.cos(x2)*math.sin(delta_lon/2)**2
        distance = 2*6371000*math.asin(min(1, math.sqrt(value)))
        return distance <= meters
    except (KeyError, ValueError, TypeError):
        return False


def matches_any_existing(row, existing):
    return any(same_business(row, prior) for prior in existing)


def only_new_within_cap(ranked, existing_ids, cap=TARGET_PER_MUNICIPALITY, existing_places=()):
    """Never select existing IDs or near-identical name+location duplicates."""
    room = max(0, cap - len(existing_ids))
    if room == 0:
        return []
    selected, seen = [], set(existing_ids)
    for row in ranked:
        identifier = row.get("id")
        if not identifier or identifier in seen:
            continue
        if matches_any_existing(row, existing_places) or matches_any_existing(row, selected):
            continue
        seen.add(identifier)
        selected.append(row)
        if len(selected) >= room:
            break
    return selected


def offer_candidate(groups, row, max_per_group):
    """Bound memory while retaining NEW companies only, across entire input scan."""
    if any(prior.get("id") == row["id"] or same_business(prior, row)
           for pool in groups.values() for prior in pool):
        return False
    pool = groups["with_site" if row.get("website") else "without_site"]
    if len(pool) < max_per_group:
        pool.append(row)
        return True
    worst = min(range(len(pool)), key=lambda idx: lead_quality(pool[idx]))
    if lead_quality(row) > lead_quality(pool[worst]):
        pool[worst] = row
        return True
    return False


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


def batch_bbox_allowed(bounds, city_count, max_span=1.8, max_area=0.9):
    """Prevent multi-town downloads that accidentally cover most of a state."""
    if city_count <= 1:
        return True
    west, south, east, north = [float(v) for v in bounds]
    width, height = east-west, north-south
    return (width > 0 and height > 0 and width <= max_span
            and height <= max_span and width*height <= max_area)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states", default="", help="Exactly one Brazilian UF")
    parser.add_argument("--cities", default="", help="One to three nearby municipalities in the same state")
    parser.add_argument("--boundaries", default=None, help="Optional pre-existing official IBGE ZIP")
    parser.add_argument("--database-max-mb", type=int, default=STORAGE_STOP_MIB)
    parser.add_argument("--max-records-per-city", type=int, default=TARGET_PER_MUNICIPALITY)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 30 <= args.database_max_mb <= STORAGE_STOP_MIB:
        parser.error("Database safety limit must be <= 340 MiB")
    if args.max_records_per_city != TARGET_PER_MUNICIPALITY:
        parser.error("Final cap must be exactly 100 per municipality")
    states = [s.strip().upper() for s in args.states.split(",") if s.strip()]
    city_keys = [normalize(s.strip()) for s in args.cities.split(",") if s.strip()]
    if len(states) != 1 or states[0] not in STATE_CODES:
        parser.error("One valid state is required")
    if len(city_keys) < 1 or len(city_keys) > 3 or len(set(city_keys)) != len(city_keys):
        parser.error("Provide 1-3 distinct nearby municipalities")
    state = states[0]
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    secret = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not args.dry_run and (base != STAGING_URL or
                            not (secret.startswith("eyJ") or secret.startswith("sb_secret_"))):
        parser.error("Only the Januário Leads STAGING project with a server-side secret is accepted")

    boundaries = ensure_state_boundaries(state, args.boundaries)
    municipalities = municipalities_index(boundaries)
    state_munis = municipalities.loc[
        (municipalities.SIGLA_UF == state) &
        (municipalities.NM_MUN.map(lambda name: normalize(str(name)) in city_keys))
    ].copy()
    found = {normalize(str(name)) for name in state_munis.NM_MUN}
    if set(city_keys) != found:
        raise RuntimeError("Municipality not found in IBGE boundaries")
    west, south, east, north = [float(v) for v in state_munis.total_bounds]
    if not batch_bbox_allowed((west, south, east, north), len(city_keys)):
        raise RuntimeError("BATCH_TOO_WIDE: municipality polygons are too dispersed for one download")
    bbox = ",".join(f"{v:.6f}" for v in (west-.005, south-.005, east+.005, north+.005))
    print(f"[{state}] Overture bbox {bbox}; cities={len(city_keys)}", flush=True)
    if args.dry_run:
        return 0

    limit_bytes = args.database_max_mb * 1024 * 1024
    storage_before = database_bytes(base, secret)
    if storage_before >= limit_bytes:
        print("STOP: database safety threshold", flush=True)
        return 2
    existing = {city: existing_city_places(base, secret, state, city)
                for city in city_keys}
    targets = {key: rows for key, rows in existing.items()
               if len(rows) < TARGET_PER_MUNICIPALITY}
    for key in city_keys:
        if key not in targets:
            print(f"ALREADY_COMPLETE: {state}/{key}", flush=True)
    if not targets:
        return 0

    with tempfile.TemporaryDirectory(prefix="overture-phase9-") as temp:
        output = Path(temp) / f"{state}.geojsonseq"
        subprocess.run(["overturemaps", "download", f"--bbox={bbox}",
                        "--type=place", "-f", "geojsonseq", "-o", str(output)],
                       check=True)
        # Scan all downloaded places ONCE, route by the official IBGE polygon.
        # Every bounded pool holds ONLY businesses not already in Supabase.
        groups_by_city = {key: {"with_site": [], "without_site": []} for key in targets}
        known_ids = {key: {r["id"] for r in rows} for key,rows in targets.items()}
        stats = {key: {"scanned": 0, "eligible": 0, "existing": 0}
                 for key in targets}
        with output.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.lstrip("\x1e").strip()
                if not line:
                    continue
                row = place_record(json.loads(line), state_munis, state)
                if row is None:
                    continue
                key = row["city_key"]
                if key not in targets or not is_lead_candidate(row):
                    continue
                stats[key]["scanned"] += 1
                if row["id"] in known_ids[key] or matches_any_existing(row, targets[key]):
                    stats[key]["existing"] += 1
                    continue
                stats[key]["eligible"] += 1
                offer_candidate(groups_by_city[key], row, TARGET_PER_MUNICIPALITY)

        total_inserted = 0
        for key in city_keys:
            if key not in targets:
                continue
            if database_bytes(base, secret) >= limit_bytes:
                print("STOP: database safety threshold", flush=True)
                return 2
            prior = targets[key]
            capacity = TARGET_PER_MUNICIPALITY - len(prior)
            groups = groups_by_city[key]
            ranked = select_diverse_pool(groups["with_site"]+groups["without_site"],capacity)
            fresh = existing_city_places(base, secret, state, key)
            proposed = only_new_within_cap(ranked,{r["id"] for r in fresh},
                                           existing_places=fresh)
            if proposed:
                api(base,secret,"/rest/v1/overture_places?on_conflict=id","POST",proposed,
                    prefer="resolution=ignore-duplicates,return=minimal")
            verified = existing_city_places(base, secret, state, key)
            gained = max(0,len(verified)-len(prior))
            total_inserted += gained
            print("PHASE9_CITY_RESULT="+json.dumps({
                "state":state,"city_key":key,"before":len(prior),
                "after":len(verified),"gained":gained,
                "new_candidates":stats[key]["eligible"],
                "status":"gained" if gained else "no_more"
            },ensure_ascii=False),flush=True)
            if len(verified)>TARGET_PER_MUNICIPALITY:
                raise RuntimeError("A municipality exceeded the safety cap of 100")
        print(f"BATCH_SUMMARY: state={state}; downloaded_for={len(targets)}; "
              f"new_companies={total_inserted}; "
              f"database_mib={database_bytes(base,secret)/1048576:.2f}",flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
