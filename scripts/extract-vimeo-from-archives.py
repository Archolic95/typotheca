#!/usr/bin/env python3
"""
Extract Vimeo video URLs from archived acrnm.com product pages.
Scans both WARC (wayback) and MHTML (live) archives.
Outputs a JSON mapping: product slug → list of vimeo URLs.
"""

import os
import re
import json
import sys

WAYBACK_DIR = "/Users/runjiatian/Desktop/drop-bot/archives/acronym-wayback"
LIVE_DIR = "/Users/runjiatian/Desktop/drop-bot/archives/acronym"

# Patterns to match Vimeo video URLs
VIMEO_PATTERNS = [
    # Progressive redirect (direct MP4)
    re.compile(r'https?://player\.vimeo\.com/progressive_redirect/playback/(\d+)/rendition/\d+p/file\.mp4[^"\'<>\s]*', re.IGNORECASE),
    # Vimeo player embed
    re.compile(r'https?://player\.vimeo\.com/video/(\d+)[^"\'<>\s]*', re.IGNORECASE),
    # Vimeo standard URL
    re.compile(r'https?://vimeo\.com/(\d+)', re.IGNORECASE),
]

# Clean up HTML entities in URLs
def clean_url(url: str) -> str:
    return url.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')

def extract_vimeo_urls(filepath: str) -> list[dict]:
    """Extract all Vimeo URLs from a file, return list of {url, vimeo_id, type}."""
    try:
        with open(filepath, 'r', errors='replace') as f:
            content = f.read()
    except Exception as e:
        print(f"  Error reading {filepath}: {e}", file=sys.stderr)
        return []

    results = []
    seen_ids = set()

    for pattern in VIMEO_PATTERNS:
        for match in pattern.finditer(content):
            url = clean_url(match.group(0))
            vimeo_id = match.group(1)
            if vimeo_id not in seen_ids:
                seen_ids.add(vimeo_id)
                url_type = 'progressive' if 'progressive_redirect' in url else 'embed' if 'player.vimeo' in url else 'standard'
                results.append({
                    'url': url,
                    'vimeo_id': vimeo_id,
                    'type': url_type,
                })

    return results

def parse_slug_from_wayback(dirname: str) -> dict:
    """Parse model code and season from wayback directory name like 'J1WTS-GT_FW2223'."""
    parts = dirname.rsplit('_', 1)
    if len(parts) == 2:
        return {'model': parts[0], 'season': parts[1], 'slug': dirname}
    return {'model': dirname, 'season': None, 'slug': dirname}

def parse_slug_from_live(dirname: str) -> dict:
    """Parse from live directory name like 'j1wts-gt-2026-03-13'."""
    # Remove date suffix
    m = re.match(r'^(.+?)-(\d{4}-\d{2}-\d{2})$', dirname)
    if m:
        slug = m.group(1).upper()
        return {'model': slug, 'season': None, 'slug': dirname}
    return {'model': dirname.upper(), 'season': None, 'slug': dirname}

def main():
    all_results = []

    # Scan wayback archives
    print(f"Scanning wayback archives: {WAYBACK_DIR}", file=sys.stderr)
    if os.path.isdir(WAYBACK_DIR):
        dirs = sorted(os.listdir(WAYBACK_DIR))
        for dirname in dirs:
            warc_path = os.path.join(WAYBACK_DIR, dirname, 'page.warc')
            if not os.path.isfile(warc_path):
                continue
            vimeo_urls = extract_vimeo_urls(warc_path)
            if vimeo_urls:
                info = parse_slug_from_wayback(dirname)
                all_results.append({
                    'source': 'wayback',
                    **info,
                    'videos': vimeo_urls,
                })

    # Scan live archives
    print(f"Scanning live archives: {LIVE_DIR}", file=sys.stderr)
    if os.path.isdir(LIVE_DIR):
        dirs = sorted(os.listdir(LIVE_DIR))
        for dirname in dirs:
            mhtml_path = os.path.join(LIVE_DIR, dirname, 'page.mhtml')
            if not os.path.isfile(mhtml_path):
                continue
            vimeo_urls = extract_vimeo_urls(mhtml_path)
            if vimeo_urls:
                info = parse_slug_from_live(dirname)
                all_results.append({
                    'source': 'live',
                    **info,
                    'videos': vimeo_urls,
                })

    # Summary
    total_products = len(all_results)
    total_videos = sum(len(r['videos']) for r in all_results)
    unique_vimeo_ids = set()
    for r in all_results:
        for v in r['videos']:
            unique_vimeo_ids.add(v['vimeo_id'])

    print(f"\nResults:", file=sys.stderr)
    print(f"  Products with videos: {total_products}", file=sys.stderr)
    print(f"  Total video references: {total_videos}", file=sys.stderr)
    print(f"  Unique Vimeo IDs: {len(unique_vimeo_ids)}", file=sys.stderr)

    # Output JSON
    output = {
        'summary': {
            'products_with_videos': total_products,
            'total_video_refs': total_videos,
            'unique_vimeo_ids': len(unique_vimeo_ids),
        },
        'results': all_results,
    }
    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
