#!/usr/bin/env python3
"""Prepare safe, municipality-sized Overture expansion commands. NEVER imports.

Run:
    python scripts/plan_overture_expansion.py --states MG,SP
    python scripts/plan_overture_expansion.py --states MG --max-records-per-city 30
All commands are printable plans with --dry-run; there are no credentials,
network calls, uploads, or subprocess execution in this script.
"""
import argparse
import shlex

# One deliberately small initial wave. Capitals in other states are candidates
# for later manual review; their national coverage is NOT yet imported.
CITY_WAVES = {
    "MG": ("Lavras", "Varginha", "Pouso Alegre", "São João del-Rei"),
    "SP": ("Campinas", "Ribeirão Preto"),
    "RJ": ("Niterói", "Petrópolis"),
    "AC": ("Rio Branco",),
    "AL": ("Maceió",),
    "AP": ("Macapá",),
    "AM": ("Manaus",),
    "BA": ("Salvador",),
    "CE": ("Fortaleza",),
    "DF": ("Brasília",),
    "ES": ("Vitória",),
    "GO": ("Goiânia",),
    "MA": ("São Luís",),
    "MT": ("Cuiabá",),
    "MS": ("Campo Grande",),
    "PA": ("Belém",),
    "PB": ("João Pessoa",),
    "PR": ("Curitiba",),
    "PE": ("Recife",),
    "PI": ("Teresina",),
    "RN": ("Natal",),
    "RS": ("Porto Alegre",),
    "RO": ("Porto Velho",),
    "RR": ("Boa Vista",),
    "SC": ("Florianópolis",),
    "SE": ("Aracaju",),
    "TO": ("Palmas",),
}

STATE_CODES = frozenset(CITY_WAVES)
INITIAL_STATES = ("MG", "SP", "RJ")
OBSERVED_INITIAL_BYTES_PER_ROW = 2184  # First 30-row Lavras pilot; not a storage guarantee.


def plan(states, per_city=30, database_max_mb=100):
    if not states or len(set(states)) != len(states) or any(st not in STATE_CODES for st in states):
        raise ValueError("Unique, valid UF codes are required")
    if not (1 <= per_city <= 100):
        raise ValueError("Per-city batch cap must be 1..100")
    if not (30 <= database_max_mb <= 480):
        raise ValueError("Database safety cap must be 30..480 MB")
    results = []
    for state in states:
        for city in CITY_WAVES[state]:
            # Only dry-run commands are emitted. Operator must consciously opt
            # into actual import later, one city at a time, with staging keys.
            parts = [
                "python", "scripts/import_overture_br.py",
                "--states", state, "--cities", city,
                "--max-records-per-state", str(per_city),
                "--max-records-per-city", str(per_city),
                "--database-max-mb", str(database_max_mb),
                "--dry-run",
            ]
            results.append((state, city, shlex.join(parts)))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states", default=",".join(INITIAL_STATES),
                        help="Default MG,SP,RJ; use all for 27 UF proposals")
    parser.add_argument("--max-records-per-city", type=int, default=30)
    parser.add_argument("--database-max-mb", type=int, default=100)
    args = parser.parse_args()
    states = [s.strip().upper() for s in args.states.split(",")]
    if states == ["ALL"]:
        states = sorted(STATE_CODES)
    try:
        commands = plan(states, args.max_records_per_city, args.database_max_mb)
    except ValueError as exc:
        parser.error(str(exc))

    ceiling_rows = len(commands) * args.max_records_per_city
    estimated_bytes = ceiling_rows * OBSERVED_INITIAL_BYTES_PER_ROW
    print("JANUARIO LEADS - NATIONAL OVERTURE EXPANSION: PLANNING ONLY")
    print(f"States planned: {len(states)} of 27 | Cities: {len(commands)}")
    print(f"Max new records per city: {args.max_records_per_city}")
    print(f"Database stop threshold in importer: {args.database_max_mb} MiB")
    print(f"Estimated row growth from FIRST pilot only: {estimated_bytes / 1024**2:.2f} MiB")
    print("WARNING: estimate excludes index/page changes, deduplication and existing rows.")
    print("WARNING: do not run all 27 states automatically; review each city pilot.")
    print("No API call or database write is performed by this planner.")
    print("")
    for index, (state, city, command) in enumerate(commands, 1):
        print(f"{index:02d}. {city} / {state}")
        print("    " + command)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
