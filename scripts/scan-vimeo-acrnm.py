#!/usr/bin/env python3
"""
Scan Vimeo ID ranges around known ACRNM uploads to find unlisted videos.
Uses the oEmbed API (no auth needed) to check ownership.
"""

import requests
import time
import json
import sys

KNOWN_IDS = sorted([
    # From archives + CSV (all known ACRNM vimeo IDs)
    # Old public videos
    2331294, 2331450, 2331487, 2331531,
    10082062, 13139368, 13140085,
    14751969, 14752892, 14753417, 14753480, 14753570, 14753839,
    15572562, 15670873,
    19922910, 19940049,
    20794402, 20827579, 20831985,
    27203858, 37657451, 39120008,
    46818058, 47598498, 50626032,
    60772746, 72127719, 85738008, 89358873,
    159828594, 191969576, 197756205, 212267977,
    261446397, 334296647,
    459145932,
    500810637, 503666205, 507608562, 510347370, 510351497,
    535825465, 535828707, 536044966, 536050187,
    # Newer unlisted product videos
    710469401,
    784796243, 784799366, 784801382, 784804531, 784805699, 784806437,
    810899133, 810903819, 814487341, 814540758, 814683038, 818783246,
    834423551,
    841801833, 841805724, 841806854, 841808237,
    891825926, 917690427,
    1018286008, 1018354894,
    1130221005, 1138897967, 1143483433,
])

KNOWN_SET = set(KNOWN_IDS)

def check_vimeo_id(vid):
    """Check if a Vimeo ID exists and belongs to ACRNM."""
    try:
        r = requests.get(
            f'https://vimeo.com/api/oembed.json?url=https://vimeo.com/{vid}',
            timeout=5,
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        if r.status_code == 200:
            d = r.json()
            return {
                'id': vid,
                'title': d.get('title', ''),
                'author': d.get('author_name', ''),
                'duration': d.get('duration', 0),
                'width': d.get('width', 0),
                'height': d.get('height', 0),
                'upload_date': d.get('upload_date', ''),
                'thumbnail_url': d.get('thumbnail_url', ''),
            }
        elif r.status_code == 403:
            # Private video — can't see details but it exists
            return {'id': vid, 'title': '[PRIVATE]', 'author': 'unknown', 'duration': 0}
        return None
    except Exception as e:
        return None

def scan_range(start, end, step=1, label=""):
    """Scan a range of Vimeo IDs."""
    found = []
    total = (end - start) // step
    checked = 0

    for vid in range(start, end + 1, step):
        if vid in KNOWN_SET:
            continue

        result = check_vimeo_id(vid)
        checked += 1

        if result and result['author'] == 'ACRNM':
            found.append(result)
            print(f"  [NEW] {vid}: \"{result['title']}\" ({result['duration']}s) {result.get('upload_date','')}", file=sys.stderr)

        # Progress
        if checked % 100 == 0:
            print(f"  ... {label} checked {checked}/{total}", file=sys.stderr)

        # Rate limiting: ~5 req/s
        if checked % 5 == 0:
            time.sleep(1)

    return found

def main():
    all_found = []

    # Strategy: scan dense clusters (nearby IDs are from same upload batch)
    # Group known IDs into clusters (IDs within 20K of each other)
    clusters = []
    current = [KNOWN_IDS[0]]
    for i in range(1, len(KNOWN_IDS)):
        if KNOWN_IDS[i] - KNOWN_IDS[i-1] < 50000:
            current.append(KNOWN_IDS[i])
        else:
            clusters.append(current)
            current = [KNOWN_IDS[i]]
    clusters.append(current)

    print(f"Found {len(clusters)} clusters of known IDs", file=sys.stderr)

    for i, cluster in enumerate(clusters):
        lo = min(cluster)
        hi = max(cluster)
        spread = hi - lo

        # Scan with padding around the cluster
        # For tight clusters, scan every ID
        # For wide clusters, scan every 10th ID
        if spread < 5000:
            pad = 2000
            step = 1
        elif spread < 50000:
            pad = 5000
            step = 5
        else:
            pad = 10000
            step = 10

        scan_start = max(1, lo - pad)
        scan_end = hi + pad
        scan_count = (scan_end - scan_start) // step

        if scan_count > 5000:
            # Too many — increase step
            step = max(step, (scan_end - scan_start) // 3000)

        label = f"Cluster {i+1}/{len(clusters)} [{lo}-{hi}]"
        print(f"\n{label}: scanning {scan_start}-{scan_end} (step={step}, ~{(scan_end-scan_start)//step} checks)", file=sys.stderr)

        found = scan_range(scan_start, scan_end, step, label)
        all_found.extend(found)

    # Output results
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"Total NEW ACRNM videos found: {len(all_found)}", file=sys.stderr)

    print(json.dumps(all_found, indent=2))

if __name__ == '__main__':
    main()
