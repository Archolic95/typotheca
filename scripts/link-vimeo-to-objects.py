#!/usr/bin/env python3
"""
Link Vimeo video URLs to their corresponding objects in Supabase.

Sources:
1. Archive extraction (WARC/MHTML) — product pages with embedded Vimeo players
2. Enriched Vimeo CSV — ACRONYM's Vimeo channel videos matched to products

Strategy:
- For archive-extracted videos: match by model code + season to objects
- For Vimeo CSV product videos: match by model code in title to objects
- Appends Vimeo progressive URLs to objects' image_urls array
- Skips lookbook/season videos (V-series) — those are handled by SeasonVideo.tsx
"""

import json
import csv
import re
import os
import sys
from supabase import create_client

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    # Try loading from .env.local
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    os.environ[k] = v
        SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
        SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Load archive extraction results ────────────────────────────────────
EXTRACTED_PATH = '/tmp/vimeo_extracted.json'

def load_archive_videos():
    """Load videos extracted from archives. Returns list of {model, season, vimeo_url, vimeo_id}."""
    if not os.path.exists(EXTRACTED_PATH):
        print("No archive extraction results found at", EXTRACTED_PATH, file=sys.stderr)
        return []

    with open(EXTRACTED_PATH) as f:
        data = json.load(f)

    results = []
    for entry in data['results']:
        model = entry['model']
        season = entry.get('season')

        # Skip V-series lookbook videos and RMT (handled by SeasonVideo.tsx)
        if re.match(r'^V\d+', model) or model.startswith('RMT'):
            continue

        for vid in entry['videos']:
            # Build progressive URL from vimeo_id if we only have embed URL
            vimeo_id = vid['vimeo_id']
            url = vid['url']
            if 'progressive_redirect' not in url:
                # We need progressive URL for direct playback
                url = f"https://player.vimeo.com/progressive_redirect/playback/{vimeo_id}/rendition/720p/file.mp4"

            results.append({
                'model': model,
                'season': season,
                'vimeo_id': vimeo_id,
                'vimeo_url': url,
            })

    return results

# ── Load Vimeo CSV product videos ──────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(__file__), '..', 'acrnm_vimeo_videos_enriched.csv')

# Product-level videos from Vimeo CSV (not lookbooks/season videos)
PRODUCT_VIDEO_PATTERNS = [
    # Title contains a model code like "J29-WS", "P38-E", "GT-J21"
    re.compile(r'^((?:[A-Z]{1,3}\d+[A-Z]?-[A-Z]{1,3}\d?(?:[A-Z]{1,2})?)|(?:[A-Z]+-[A-Z]+\d+[A-Z]*))', re.IGNORECASE),
]

# Known season lookbook titles to skip
LOOKBOOK_KEYWORDS = ['Acronymjutsu', 'Werkverzeichnis', 'THE CUT', 'SLIGHT RETURN',
                     'ANYTHING THAT MOVES', 'MOV_1-4', 'LIGHTEST FASTEST',
                     'Uslu Airlines', 'ACR-FW-0405', 'ACR-FW-1011',
                     'ACR-FW-1112', 'ACR_MOV_']

def load_csv_product_videos():
    """Load product-specific videos from Vimeo CSV. Returns list of {model, vimeo_id, vimeo_url, title}."""
    if not os.path.exists(CSV_PATH):
        print("No enriched CSV found at", CSV_PATH, file=sys.stderr)
        return []

    results = []
    with open(CSV_PATH) as f:
        reader = csv.DictReader(f)
        for row in reader:
            title = row['title'].strip()
            link = row['link'].strip()

            # Skip known lookbook/season videos
            if any(kw.lower() in title.lower() for kw in LOOKBOOK_KEYWORDS):
                continue

            # Skip V-series lookbooks
            if re.match(r'^V\d+', title):
                continue

            # Extract vimeo ID from URL
            m = re.search(r'vimeo\.com/(\d+)', link)
            if not m:
                continue
            vimeo_id = m.group(1)

            # Extract model code from title
            # Handle formats: "J29-WS (One take)", "P38-E DFMA", "GT-J21", "3A-9TS", "SP3-X"
            model_match = re.match(r'^([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)?)', title, re.IGNORECASE)
            if not model_match:
                continue

            model = model_match.group(1).upper()

            results.append({
                'model': model,
                'vimeo_id': vimeo_id,
                'vimeo_url': f"https://player.vimeo.com/progressive_redirect/playback/{vimeo_id}/rendition/720p/file.mp4",
                'title': title,
            })

    return results

# ── Normalize model codes for matching ─────────────────────────────────
def normalize_model(code: str) -> str:
    """Normalize ACRONYM model code for matching.
    Handles: old format (GT-J22 → J22-GT), missing hyphens, etc.
    """
    code = code.upper().strip()
    # Remove colorway suffixes for matching
    # e.g., BK3-PS → BK3-PS (keep), J1WTS-GT → J1WTS-GT (keep)
    return code

def find_objects_by_model(model: str, season: str = None):
    """Find objects in Supabase matching a model code, optionally with season."""
    # Try exact model_code match first
    query = supabase.table('objects').select('id,name,model_code,season,image_urls,brand').eq('brand', 'acronym')

    if season and season != 'NA':
        # Normalize season: FW2223 → FW22, FW2526 → FW25
        norm_season = season
        if len(season) > 4 and re.match(r'^(SS|FW|AW)\d{4}$', season):
            norm_season = season[:4]  # FW2223 → FW22

        result = query.eq('model_code', model).eq('season', norm_season).execute()
        if result.data:
            return result.data

        # Try with full season
        result = query.eq('model_code', model).eq('season', season).execute()
        if result.data:
            return result.data

    # Try without season constraint
    result = query.eq('model_code', model).execute()
    if result.data:
        return result.data

    # Try name-based search (model code in name)
    result = supabase.table('objects').select('id,name,model_code,season,image_urls,brand').eq('brand', 'acronym').ilike('name', f'%{model}%').execute()
    return result.data or []

# ── Main ───────────────────────────────────────────────────────────────
def main():
    archive_videos = load_archive_videos()
    csv_videos = load_csv_product_videos()

    print(f"Archive product videos: {len(archive_videos)}", file=sys.stderr)
    print(f"CSV product videos: {len(csv_videos)}", file=sys.stderr)

    # Combine and deduplicate by vimeo_id
    all_videos = {}
    for v in archive_videos:
        all_videos[v['vimeo_id']] = v
    for v in csv_videos:
        if v['vimeo_id'] not in all_videos:
            all_videos[v['vimeo_id']] = v

    print(f"Total unique product videos: {len(all_videos)}", file=sys.stderr)
    print("", file=sys.stderr)

    matched = []
    unmatched = []
    already_has = []

    for vimeo_id, video in sorted(all_videos.items(), key=lambda x: x[1]['model']):
        model = video['model']
        season = video.get('season')
        vimeo_url = video['vimeo_url']

        objects = find_objects_by_model(model, season)

        if not objects:
            unmatched.append(video)
            print(f"  ✗ No match: {model} ({season or 'no season'}) — vimeo:{vimeo_id}", file=sys.stderr)
            continue

        for obj in objects:
            existing_urls = obj.get('image_urls') or []
            # Check if this vimeo video is already in image_urls
            if any(vimeo_id in (u or '') for u in existing_urls):
                already_has.append({'object': obj, 'video': video})
                print(f"  ○ Already has: {obj['name']} ({obj['season']}) — vimeo:{vimeo_id}", file=sys.stderr)
                continue

            matched.append({'object': obj, 'video': video, 'new_url': vimeo_url})
            print(f"  ✓ Match: {model} → {obj['name']} ({obj['season']}) — vimeo:{vimeo_id}", file=sys.stderr)

    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Matched: {len(matched)} object-video pairs", file=sys.stderr)
    print(f"Already present: {len(already_has)}", file=sys.stderr)
    print(f"Unmatched: {len(unmatched)}", file=sys.stderr)

    if not matched:
        print("\nNo new videos to add.", file=sys.stderr)
        return

    # Dry run — show what would be updated
    print(f"\nWill add video URLs to {len(matched)} objects:", file=sys.stderr)
    for m in matched:
        obj = m['object']
        print(f"  {obj['name']} ({obj['season']}) ← vimeo:{m['video']['vimeo_id']}", file=sys.stderr)

    # Check for --apply flag
    if '--apply' not in sys.argv:
        print("\nDry run. Pass --apply to update Supabase.", file=sys.stderr)
        # Output JSON for review
        output = {
            'matched': [{'object_id': m['object']['id'], 'name': m['object']['name'], 'season': m['object']['season'], 'vimeo_url': m['new_url']} for m in matched],
            'unmatched': unmatched,
        }
        print(json.dumps(output, indent=2))
        return

    # Apply updates
    print(f"\nApplying {len(matched)} updates...", file=sys.stderr)
    success = 0
    errors = 0

    for m in matched:
        obj = m['object']
        new_url = m['new_url']
        existing_urls = obj.get('image_urls') or []
        updated_urls = existing_urls + [new_url]

        try:
            supabase.table('objects').update({'image_urls': updated_urls}).eq('id', obj['id']).execute()
            success += 1
            print(f"  ✓ Updated {obj['name']}", file=sys.stderr)
        except Exception as e:
            errors += 1
            print(f"  ✗ Error updating {obj['name']}: {e}", file=sys.stderr)

    print(f"\nDone: {success} updated, {errors} errors", file=sys.stderr)

if __name__ == '__main__':
    main()
