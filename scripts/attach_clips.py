#!/usr/bin/env python3
"""
Attach season video clips to Acronym objects in Supabase.
- For existing objects: PATCH to append clip URL to image_urls
- For missing objects: POST to create new object with clip URL
"""

import json
import os
import re
import requests
from pathlib import Path

# --- Config ---
PROJECT_ROOT = Path("/Users/runjiatian/Desktop/typotheca")
CUTS_DIR = PROJECT_ROOT / "videos" / "cuts"

# Load env
env = {}
with open(PROJECT_ROOT / ".env.local") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            env[k] = v

SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]
ANON_KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE_KEY = env["SUPABASE_SERVICE_KEY"]

# Season mapping
SEASON_MAP = {
    "FW0405": "FW04",
    "FW1011": "FW10",
    "FW1112F": "FW11",
    "FW1112M": "FW11",
    "FW1213": "FW12",
    "FW1314": "FW13",
    "FW1415": "FW14",
    "FW1718": "FW17",
    "LFDB": "SS11",
    "LFDB-SET": "SS11",
    "SS12": "SS12",
    "SS12v2": "SS12",
    "SS13": "SS13",
    "SS14": "SS14",
    "SS17": "SS17",
}

# Skip these model codes
SKIP_MODELS = {"unknown", "non-ACR"}
SKIP_PREFIXES = ("bag ", "jacket ", "pants ", "shorts ", "ACRONYM", "GT jacket")

# Textile prefixes for name flipping
TEXTILE_PREFIXES = ["GT", "SS", "DS", "S", "E", "WS", "L", "LP", "PL", "X"]

# Category detection
CLOTHING_PREFIXES = ("J", "P", "S")  # Jackets, Pants, Shirts/Shells
ACCESSORY_PREFIXES = ("3A", "NTS", "CP", "NG")


def get_category(model_code):
    """Determine category from model code prefix."""
    upper = model_code.upper()
    for prefix in ACCESSORY_PREFIXES:
        if upper.startswith(prefix):
            return "Accessories"
    for prefix in CLOTHING_PREFIXES:
        if upper.startswith(prefix):
            return "Clothing"
    # Default to Clothing for ambiguous
    return "Clothing"


def flip_name(model_code):
    """Try flipping naming convention: GT-J28 <-> J28-GT"""
    parts = model_code.split("-")
    if len(parts) != 2:
        return []

    flipped = []
    # Try prefix-model -> model-prefix
    for tp in TEXTILE_PREFIXES:
        if parts[0].upper() == tp:
            flipped.append(f"{parts[1]}-{parts[0]}")
            break
        if parts[1].upper() == tp:
            flipped.append(f"{parts[1]}-{parts[0]}")
            break

    # Also just try a straight flip regardless
    straight_flip = f"{parts[1]}-{parts[0]}"
    if straight_flip not in flipped:
        flipped.append(straight_flip)

    return flipped


def fetch_acronym_objects():
    """Fetch all Acronym objects from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/objects"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
    }
    params = {
        "or": "(brand.ilike.*acronym*,brand.ilike.*ACRNM*)",
        "select": "id,name,season,image_urls,model_code",
        "limit": "10000",
    }

    all_objects = []
    offset = 0
    while True:
        params["offset"] = str(offset)
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        all_objects.extend(batch)
        if len(batch) < 1000:
            break
        offset += len(batch)

    print(f"Fetched {len(all_objects)} Acronym objects from Supabase")
    return all_objects


def build_name_map(objects):
    """Build lookup: uppercase name/model_code -> list of objects."""
    name_map = {}
    for obj in objects:
        keys = set()
        if obj.get("name"):
            keys.add(obj["name"].upper().strip())
        if obj.get("model_code"):
            keys.add(obj["model_code"].upper().strip())
        for k in keys:
            if k not in name_map:
                name_map[k] = []
            name_map[k].append(obj)
    return name_map


def find_object(model_code, name_map, target_season=None):
    """Find object in name_map, trying flipped names too. Prefer same-season."""
    candidates_to_try = [model_code.upper()]
    for flipped in flip_name(model_code):
        candidates_to_try.append(flipped.upper())

    for candidate in candidates_to_try:
        if candidate in name_map:
            objects = name_map[candidate]
            if len(objects) == 1:
                return objects[0]
            # Multiple matches - prefer same season
            if target_season:
                for obj in objects:
                    if obj.get("season") and obj["season"].upper() == target_season.upper():
                        return obj
            # Return first match if no season match
            return objects[0]
    return None


def patch_object(obj_id, image_urls):
    """PATCH object to update image_urls."""
    url = f"{SUPABASE_URL}/rest/v1/objects?id=eq.{obj_id}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    data = {"image_urls": image_urls}
    resp = requests.patch(url, headers=headers, json=data)
    resp.raise_for_status()
    return resp.status_code


def create_object(obj_data):
    """POST to create new object."""
    url = f"{SUPABASE_URL}/rest/v1/objects"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    resp = requests.post(url, headers=headers, json=obj_data)
    resp.raise_for_status()
    return resp.json()


def main():
    # Fetch objects
    objects = fetch_acronym_objects()
    name_map = build_name_map(objects)

    stats = {"patched": 0, "created": 0, "skipped": 0, "already_has": 0}
    actions = []

    # Process each season
    for season_dir in sorted(os.listdir(CUTS_DIR)):
        looks_file = CUTS_DIR / season_dir / "looks.json"
        if not looks_file.exists():
            continue

        data = json.load(open(looks_file))
        looks = data.get("looks", [])
        mapped_season = SEASON_MAP.get(season_dir, season_dir)

        for look in looks:
            label = look.get("label", "")
            look_num = look.get("look", 0)

            # Skip intro/outro
            if label in ("intro", "outro") or "intro" in label or "outro" in label:
                continue

            pieces = look.get("pieces", [])
            # Build clip path
            look_dir_name = f"look{look_num}_{label}"
            clip_path = f"/videos/cuts/{season_dir}/{look_dir_name}/look{look_num}.mp4"

            # Verify clip exists
            full_clip_path = PROJECT_ROOT / clip_path.lstrip("/")
            if not full_clip_path.exists():
                continue

            for piece in pieces:
                # Handle both dict and string pieces
                if isinstance(piece, str):
                    model_code = piece.strip()
                else:
                    model_code = piece.get("model", "").strip()

                # Skip conditions
                if not model_code:
                    continue
                if model_code in SKIP_MODELS:
                    stats["skipped"] += 1
                    continue
                if any(model_code.startswith(p) for p in SKIP_PREFIXES):
                    stats["skipped"] += 1
                    continue

                # Find in DB
                obj = find_object(model_code, name_map, target_season=mapped_season)

                if obj:
                    # Check if clip already in image_urls
                    existing_urls = obj.get("image_urls") or []
                    if clip_path in existing_urls:
                        stats["already_has"] += 1
                        continue

                    # PATCH to append
                    new_urls = existing_urls + [clip_path]
                    try:
                        patch_object(obj["id"], new_urls)
                        obj["image_urls"] = new_urls  # Update local copy
                        stats["patched"] += 1
                        actions.append(f"PATCH {model_code} (id={obj['id']}) += {clip_path}")
                    except Exception as e:
                        actions.append(f"PATCH FAILED {model_code} (id={obj['id']}): {e}")
                else:
                    # Create new object
                    category = get_category(model_code)
                    new_obj = {
                        "brand": "acronym",
                        "name": model_code,
                        "model_code": model_code,
                        "season": mapped_season,
                        "image_urls": [clip_path],
                        "category_1": category,
                        "source_url": f"https://acrnm.com/products/{model_code}",
                        "source_site": "acrnm.com",
                    }
                    try:
                        result = create_object(new_obj)
                        created_obj = result[0] if isinstance(result, list) else result
                        new_id = created_obj.get("id")
                        stats["created"] += 1
                        actions.append(f"CREATE {model_code} season={mapped_season} cat={category} -> id={new_id}")

                        # Add to name_map to avoid duplicate creates
                        key = model_code.upper()
                        entry = {
                            "id": new_id,
                            "name": model_code,
                            "model_code": model_code,
                            "season": mapped_season,
                            "image_urls": [clip_path],
                        }
                        if key not in name_map:
                            name_map[key] = []
                        name_map[key].append(entry)
                    except Exception as e:
                        actions.append(f"CREATE FAILED {model_code}: {e}")

    # Summary
    print("\n=== SUMMARY ===")
    print(f"Patched (clip appended): {stats['patched']}")
    print(f"Created (new objects):   {stats['created']}")
    print(f"Already had clip:        {stats['already_has']}")
    print(f"Skipped (unknown/etc):   {stats['skipped']}")
    print(f"\n=== ACTIONS ({len(actions)}) ===")
    for a in actions:
        print(f"  {a}")


if __name__ == "__main__":
    main()
