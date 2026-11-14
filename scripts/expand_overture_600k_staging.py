#!/usr/bin/env python3
"""FASE 9 V5 — Overture only, manually resumable, STAGING ONLY.

IBGE population determines per-city caps in the companion notebook.
This importer adds at most 40 NEW useful companies per download, conserves
old rows, deduplicates IDs and close same-name businesses and stops at
600,000 national places, 340 MiB Overture or 440 MiB entire database.
No Google Places, Geoapify, paid API, production or background execution.
"""
import argparse
from collections import Counter
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlencode

import expand_overture_to_100_staging as v4

STAGING_URL = "https://prlrxjothrslhswpkoza.supabase.co"
GOAL_COMPANIES = 600000
OVERTURE_MAX_MIB = 340
DATABASE_MAX_MIB = 440
MIB = 1048576
MAX_NEW_PER_BATCH = 40
MAX_CITIES_PER_BATCH = 3
MAX_ROW_ESTIMATE = 1024
CITY_CAPS = {"small":100, "medium":240, "large":700, "metro":2400, "unknown":100}
GROUPS = {
    "barber":"beauty","beauty_salon":"beauty","hair_salon":"beauty",
    "nail_salon":"beauty","spa":"beauty","tattoo_and_piercing":"beauty",
    "restaurant":"food","brazilian_restaurant":"food","pizza_restaurant":"food",
    "burger_restaurant":"food","barbecue_restaurant":"food","steakhouse":"food",
    "bakery":"food","cafe":"food","coffee_shop":"food",
    "ice_cream_shop":"food","dessert_shop":"food","butcher_shop":"food",
    "grocery_store":"food","produce_store":"food",
    "dental_clinic":"health","general_dentistry":"health",
    "doctors_office":"health","pharmacy":"health","physical_therapy":"health",
    "psychologist":"health","eyewear_store":"health",
    "veterinarian":"pets","veterinary_care":"pets","pet_store":"pets",
    "gym":"fitness","fitness_center":"fitness","pilates_studio":"fitness",
    "automotive_repair":"auto","auto_detailing":"auto","auto_dealer":"auto",
    "car_wash":"auto","motorcycle_repair":"auto","auto_parts_store":"auto",
    "hotel":"lodging","inn":"lodging","bed_and_breakfast":"lodging",
    "hostel":"lodging","lodge":"lodging","guest_house":"lodging",
    "clothing_store":"retail","shoe_store":"retail","furniture_store":"retail",
    "building_supply_store":"retail","hardware_store":"retail",
    "jewelry_store":"retail","flowers_and_gifts_store":"retail",
    "accountant":"professional","attorney_or_law_firm":"professional",
    "real_estate_service":"professional","real_estate_agent":"professional",
    "architectural_designer":"professional","printing_service":"professional",
    "language_school":"education","driving_school":"education",
}
BLOCKED = set(v4.NON_LEAD_CATEGORIES) | {
    "park","public_plaza","town_hall","government_office","police_station",
    "school","public_school","college_university","public_library",
    "historic_site","monument","cemetery","bus_stop",
    "religious_organization","social_or_community_service",
}
BLOCK_CONTAINS = ("place_of_worship","government_")

def group(row):
    return GROUPS.get(str(row.get("category") or "").lower(), "other")

def quality(row):
    digits = re.sub(r"\D", "", str(row.get("phone") or ""))
    has_phone = 10 <= len(digits) <= 13
    has_email = bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",
                                 str(row.get("email") or "")))
    confidence = row.get("confidence")
    conf = float(confidence) if isinstance(confidence,(int,float)) and math.isfinite(confidence) else 0
    return (13*has_phone + 10*has_email +
            7*v4.is_business_website(row.get("website")) +
            4*bool(row.get("instagram")) + 5*conf)

def useful(row):
    cat = str(row.get("category") or "").lower().strip()
    name = str(row.get("name") or "").strip()
    digits=re.sub(r"\D","",str(row.get("phone") or ""))
    contact=(10<=len(digits)<=13 or
             bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+",
                               str(row.get("email") or ""))) or
             v4.is_business_website(row.get("website")) or
             bool(row.get("instagram")))
    return (len(name)>=3 and bool(cat) and
            cat not in BLOCKED and
            not any(part in cat for part in BLOCK_CONTAINS) and contact)

def pick_balanced(candidates, existing, limit):
    if limit<=0: return []
    ids={x["id"] for x in existing}
    by_name={}
    count=Counter(group(x) for x in existing)
    category_count=Counter(str(x.get("category") or "").lower() for x in existing)
    for old in existing:
        by_name.setdefault(old.get("name_key") or v4.normalize(old["name"]),[]).append(old)
    new=[]
    for row in sorted(candidates,key=lambda x:(quality(x),str(x.get("id"))),reverse=True):
        key=row.get("name_key") or v4.normalize(row.get("name") or "")
        if not useful(row) or not row.get("id") or row["id"] in ids:
            continue
        if any(v4.same_business(row,prev) for prev in by_name.get(key,[])):
            continue
        ids.add(row["id"])
        by_name.setdefault(key,[]).append(row)
        new.append(row)
    out=[]
    while new and len(out)<limit:
        def score(x):
            family=group(x)
            coverage=20/(1+count[family]**0.5)
            category=str(x.get("category") or "").lower()
            specific_niche=17/(1+category_count[category]**0.5)
            return quality(x)+coverage+specific_niche+(4 if family!="other" else -6)
        idx=max(range(len(new)),key=lambda i:(score(new[i]),str(new[i]["id"])))
        row=new.pop(idx)
        out.append(row)
        count[group(row)]+=1
        category_count[str(row.get("category") or "").lower()]+=1
    return out

def current_stats(base_url,key):
    result=v4.api(base_url,key,"/rest/v1/rpc/overture_phase9_v5_status",method="POST",payload={})
    if (not isinstance(result,dict) or
        any(not isinstance(result.get(n),int) or result[n]<0
            for n in ("total_companies","overture_bytes","database_bytes"))):
        raise RuntimeError("Missing private V5 storage guard in staging")
    return result

def safe_capacity(stats,requested):
    """Strict DB+table budgets, 1KiB/row cautious preflight estimate."""
    if (stats["total_companies"]>=GOAL_COMPANIES or
        stats["overture_bytes"]>=OVERTURE_MAX_MIB*MIB or
        stats["database_bytes"]>=DATABASE_MAX_MIB*MIB):
        return 0
    return max(0,min(requested,GOAL_COMPANIES-stats["total_companies"],
        (OVERTURE_MAX_MIB*MIB-stats["overture_bytes"])//MAX_ROW_ESTIMATE,
        (DATABASE_MAX_MIB*MIB-stats["database_bytes"])//MAX_ROW_ESTIMATE))

def existing_city(base_url,key,state,city_key,maximum):
    """Read entire city (up to 2,400 records), unlike the former 100-row importer."""
    rows=[]
    while True:
        query=urlencode({"select":"id,name,name_key,category,latitude,longitude",
                         "state":"eq."+state,"city_key":"eq."+city_key,
                         "order":"id.asc","offset":str(len(rows)),"limit":"1000"})
        page=v4.api(base_url,key,"/rest/v1/overture_places?"+query)
        if not isinstance(page,list):
            raise RuntimeError("Could not read existing companies")
        rows.extend(page)
        if len(rows)>maximum:
            raise RuntimeError("City contains more companies than allowed by its tier")
        if len(page)<1000:break
    return rows

def validate_plans(plans,requested):
    if not isinstance(plans,dict) or set(plans)!=set(requested):
        raise ValueError("Cities and plans must match exactly")
    out={}
    for city,p in plans.items():
        if (not isinstance(p,dict) or
            p.get("tier") not in CITY_CAPS or
            not isinstance(p.get("target"),int) or isinstance(p.get("target"),bool)
            or p["target"]<1 or p["target"]>CITY_CAPS[p["tier"]]):
            raise ValueError("Invalid tier or population-based city quota")
        out[city]=p
    return out

def record_checkpoint(base_url,key,state,city_key,city,plan,before,after,result,error_code=None):
    """V5 progress is independent of the V4 +40 lifetime baseline."""
    query=urlencode({"select":"first_count","state":"eq."+state,"city_key":"eq."+city_key,"limit":"1"})
    old=v4.api(base_url,key,"/rest/v1/overture_phase9_v5_attempts?"+query)
    if not isinstance(old,list):raise RuntimeError("V5 checkpoint read failed")
    initial=min(before,old[0]["first_count"]) if old else before
    payload=[{
        "state":state,"city_key":city_key,"city":city,
        "population":plan.get("population"),"tier":plan["tier"],
        "target_count":plan["target"],"first_count":initial,
        "after_count":after,"added_count":max(0,after-initial),
        "result":result,"error_code":error_code,
        "attempted_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        # Successful/incomplete cities may be revisited next manually run;
        # a no-more candidate needs a new Overture dataset to retry.
        "retry_after":None,
    }]
    v4.api(base_url,key,"/rest/v1/overture_phase9_v5_attempts?on_conflict=state,city_key",
           method="POST",payload=payload,prefer="resolution=merge-duplicates,return=minimal")

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--states",required=True)
    parser.add_argument("--cities",required=True)
    parser.add_argument("--plans-json",required=True)
    parser.add_argument("--dry-run",action="store_true")
    args=parser.parse_args(argv)
    states=[s.strip().upper() for s in args.states.split(",") if s.strip()]
    cities=[s.strip() for s in args.cities.split(",") if s.strip()]
    keys=[v4.normalize(c) for c in cities]
    if (len(states)!=1 or states[0] not in v4.STATE_CODES or
        not 1<=len(keys)<=MAX_CITIES_PER_BATCH or len(set(keys))!=len(keys)):
        parser.error("Choose 1-3 distinct nearby cities in ONE Brazilian state")
    try:plans=validate_plans(json.loads(args.plans_json),keys)
    except (ValueError,TypeError,KeyError) as exc:parser.error(str(exc))
    boundaries=v4.ensure_state_boundaries(states[0])
    municipalities=v4.municipalities_index(boundaries)
    state_munis=municipalities.loc[
        (municipalities.SIGLA_UF==states[0])&
        (municipalities.NM_MUN.map(lambda n:v4.normalize(str(n)) in keys))
    ].copy()
    if {v4.normalize(str(n)) for n in state_munis.NM_MUN}!=set(keys):
        raise RuntimeError("IBGE municipality not found")
    bounds=[float(v) for v in state_munis.total_bounds]
    if not v4.batch_bbox_allowed(bounds,len(keys)):
        raise RuntimeError("BATCH_TOO_WIDE: use separate cities instead")
    bbox=",".join(f"{n:.6f}" for n in
                  [bounds[0]-.005,bounds[1]-.005,bounds[2]+.005,bounds[3]+.005])
    if args.dry_run:
        print("OFFLINE PREFLIGHT OK:",states[0],list(zip(cities,[plans[k]["target"] for k in keys])))
        return 0

    base_url=os.getenv("SUPABASE_URL","").rstrip("/")
    secret=os.getenv("SUPABASE_SERVICE_ROLE_KEY","")
    if (base_url!=STAGING_URL or
        not (secret.startswith("eyJ") or secret.startswith("sb_secret_"))):
        parser.error("Only STAGING SUPABASE_URL and private STAGING service-role key are accepted")
    status=current_stats(base_url,secret)
    if safe_capacity(status,1)==0:
        print("SAFE STOP: national or database/table storage quota")
        return 2
    existing={k:existing_city(base_url,secret,states[0],k,plans[k]["target"])
              for k in keys}
    room={k:min(MAX_NEW_PER_BATCH,plans[k]["target"]-len(existing[k])) for k in keys}
    if not any(v>0 for v in room.values()):
        print("CITY_QUOTAS_COMPLETE")
        return 0

    with tempfile.TemporaryDirectory(prefix="januleads-overture-v5-") as tmp:
        path=Path(tmp)/"cities.geojsonseq"
        subprocess.run(["overturemaps","download",f"--bbox={bbox}",
                        "--type=place","-f","geojsonseq","-o",str(path)],
                       check=True)
        # Scan the full source, not just 100 first places. Keep bounded pools.
        known={k:{row["id"] for row in rows} for k,rows in existing.items()}
        pool={k:[] for k in keys}
        for line in path.open(encoding="utf-8"):
            text=line.lstrip("\x1e").strip()
            if not text:continue
            record=v4.place_record(json.loads(text),state_munis,states[0])
            if not record:continue
            city_key=record["city_key"]
            if (room.get(city_key,0)==0 or not useful(record) or
                record["id"] in known[city_key] or
                v4.matches_any_existing(record,existing[city_key])):
                continue
            # A diverse bounded pool of high-quality new results; no memory blow-up.
            candidates=pool[city_key]
            candidates.append(record)
            if len(candidates)>3000:
                # Preserve diverse niche families in memory. Keeping only
                # the top 2,000 by contact score would bias large cities.
                families={}
                for item in candidates:
                    families.setdefault(group(item),[]).append(item)
                del candidates[:]
                for family,items in families.items():
                    items.sort(key=quality,reverse=True)
                    candidates.extend(items[:260])
                if len(candidates)>2900:
                    candidates.sort(key=quality,reverse=True)
                    del candidates[2900:]
        total_new=0
        for k in keys:
            if room[k]<=0:continue
            before=len(existing[k])
            # Fresh concurrent counts, ID and name/location checks every round.
            fresh=existing_city(base_url,secret,states[0],k,plans[k]["target"])
            capacity=min(room[k],plans[k]["target"]-len(fresh))
            selected=pick_balanced(pool[k],fresh,capacity)
            check=current_stats(base_url,secret)
            selected=selected[:safe_capacity(check,len(selected))]
            if not selected:
                # Mark source-exhausted cities so Colab avoids repeated
                # downloads for the same missing candidates.
                stop_by_budget=safe_capacity(check,1)==0
                if not stop_by_budget:
                    record_checkpoint(base_url,secret,states[0],k,
                        next(c for c in cities if v4.normalize(c)==k),
                        plans[k],before,len(fresh),"no_more")
                print("CITY_RESULT "+json.dumps({"city":k,"added":0,"before":before,
                      "after":len(fresh),"status":"budget" if stop_by_budget else "no_more"}))
                if stop_by_budget:
                    print("SAFE STOP: no quota for another business")
                    return 2
                continue
            # Small bounded inserts with a check before each batch; do not overwrite
            # any previously saved company or silently replace its fields.
            v4.api(base_url,secret,"/rest/v1/overture_places?on_conflict=id",
                   method="POST",payload=selected,
                   prefer="resolution=ignore-duplicates,return=minimal")
            verified=existing_city(base_url,secret,states[0],k,plans[k]["target"])
            added=max(0,len(verified)-before)
            total_new+=added
            result="complete" if len(verified)>=plans[k]["target"] else "gained" if added else "no_more"
            record_checkpoint(base_url,secret,states[0],k,
                              next(c for c in cities if v4.normalize(c)==k),
                              plans[k],before,len(verified),result)
            print("CITY_RESULT "+json.dumps({"city":k,"added":added,
                  "after":len(verified),"target":plans[k]["target"]}))
            if safe_capacity(current_stats(base_url,secret),1)==0:
                print("SAFE STOP: storage or national quota reached")
                return 2
        after=current_stats(base_url,secret)
        print("BATCH_SUMMARY "+json.dumps({"added":total_new,
              "national_total":after["total_companies"],
              "overture_mib":round(after["overture_bytes"]/MIB,2),
              "database_mib":round(after["database_bytes"]/MIB,2)}))
    return 0

if __name__=="__main__":
    sys.exit(main())
