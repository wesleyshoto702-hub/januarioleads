#!/usr/bin/env python3
"""Import Overture Places into private Supabase table, scoped to Brazil's municipalities.

Pre-req:
    pip install overturemaps geopandas shapely pyogrio
    export SUPABASE_URL='https://<project>.supabase.co'
    export SUPABASE_SERVICE_ROLE_KEY='<service role secret>'
    python scripts/import_overture_br.py --states MG,SP --database-max-mb 400

The runner covers all 27 federal units by default. Each state is streamed
separately; it does not attempt to download and retain a global Overture file.
It stops BEFORE reaching a configured database threshold, and reports partial
coverage honestly. Never run from a browser or publish the service-role key.
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

IBGE_2024_URL = (
    "https://geoftp.ibge.gov.br/organizacao_do_territorio/"
    "malhas_territoriais/malhas_municipais/municipio_2024/"
    "Brasil/BR_Municipios_2024.zip"
)
STATE_CODES = (
    "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI "
    "RJ RN RS RO RR SC SP SE TO"
).split()
BATCH_SIZE = 150


def normalize(value):
    return " ".join(
        "".join(
            c for c in unicodedata.normalize("NFD", value.casefold())
            if unicodedata.category(c) != "Mn"
        ).split()
    )


def first(values):
    return next((v for v in (values or []) if isinstance(v, str) and v.strip()), None)


def api(base, key, path, method="GET", payload=None):
    data = json.dumps(payload, ensure_ascii=False).encode() if payload is not None else None
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
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
    identifier = props.get("id")
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
    instagram = first([s for s in socials if isinstance(s, str) and
                       re.search(r"https?://(?:www\\.)?instagram\\.com/", s, re.I)])
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
        "website": (first(props.get("websites")) or "")[:500] or None,
        "instagram": instagram[:500] if instagram else None,
        "confidence": confidence if isinstance(confidence, (int, float)) else None,
        "operating_status": str(props.get("operating_status") or "")[:35] or None,
        "data_release": os.getenv("OVERTURE_DATA_RELEASE", "latest")[:80],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states", default=",".join(STATE_CODES),
                        help="Comma-separated UF codes; default all 27")
    parser.add_argument("--boundaries", default="data/BR_Municipios_2024.zip")
    parser.add_argument("--database-max-mb", type=int, default=400)
    parser.add_argument("--max-records-per-state", type=int, default=0,
                        help="0=all; nonzero limits state rows and marks coverage partial")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.database_max_mb < 30 or args.database_max_mb > 480:
        parser.error("--database-max-mb must be between 30 and 480 MB")
    if args.max_records_per_state < 0:
        parser.error("--max-records-per-state cannot be negative")
    states = [s.strip().upper() for s in args.states.split(",")]
    if not states or len(set(states)) != len(states) or any(s not in STATE_CODES for s in states):
        parser.error("--states must contain unique Brazilian UF codes")

    boundaries = Path(args.boundaries)
    if not boundaries.is_file():
        boundaries.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading public IBGE boundaries: {IBGE_2024_URL}", flush=True)
        request.urlretrieve(IBGE_2024_URL, boundaries)
    municipalities = municipalities_index(boundaries)
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not args.dry_run and (not base.startswith("https://") or not key):
        parser.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    limit_bytes = args.database_max_mb * 1024 * 1024
    for state in states:
        state_munis = municipalities.loc[municipalities.SIGLA_UF == state].copy()
        west, south, east, north = state_munis.total_bounds
        # Slightly wider rectangle avoids border rounding gaps.
        bbox = ",".join(f"{v:.6f}" for v in (west - .005, south - .005, east + .005, north + .005))
        print(f"[{state}] Overture bbox {bbox}", flush=True)
        if args.dry_run:
            continue
        if database_bytes(base, key) >= limit_bytes:
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
                batch = []
                partial = False
                with out.open("r", encoding="utf-8") as src:
                    for line in src:
                        line = line.lstrip("\x1e").strip()
                        if not line:
                            continue
                        row = place_record(json.loads(line), state_munis, state)
                        if row is None:
                            continue
                        batch.append(row)
                        if len(batch) < BATCH_SIZE:
                            continue
                        if database_bytes(base, key) >= limit_bytes:
                            partial = True
                            break
                        api(base, key, "/rest/v1/overture_places?on_conflict=id", "POST", batch)
                        total += len(batch)
                        batch.clear()
                        if args.max_records_per_state and total >= args.max_records_per_state:
                            partial = True
                            break
                if batch and not partial:
                    if database_bytes(base, key) >= limit_bytes:
                        partial = True
                    else:
                        api(base, key, "/rest/v1/overture_places?on_conflict=id", "POST", batch)
                        total += len(batch)
                status(base, key, state, "partial" if partial else "complete", total)
                print(f"[{state}] {total} imported; {'PARTIAL' if partial else 'COMPLETE'}", flush=True)
                if partial and database_bytes(base, key) >= limit_bytes:
                    print("STOP: database safety threshold; remaining states NOT imported.", flush=True)
                    return 2
        except Exception as exc:
            status(base, key, state, "error", total, str(exc)[:200])
            raise
    print("Ingestion pass ended. Check overture_import_progress for coverage.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
