#!/usr/bin/env python3
"""
Exhaustive Wayback Machine scraper for acrnm.com.

Strategy:
1. Query CDX API for ALL acrnm.com HTML pages
2. For each product page, fetch the best snapshot
3. Parse product data: name, price, images, description, season
4. Compare with existing DB and output new/enriched products

Uses iproyal proxy to avoid rate limiting.
"""

import json, re, os, sys, time, hashlib
from urllib.parse import urlparse, urljoin
from collections import defaultdict
import urllib.request

# ── Config ──────────────────────────────────────────────────────────────
PROXY_URL = os.environ.get('PROXY_URL', '')
OUTPUT_DIR = '/tmp/wayback-acrnm'
CDX_BASE = 'https://web.archive.org/cdx/search/cdx'
WB_BASE = 'https://web.archive.org/web'
DELAY = 1.5  # seconds between requests
MAX_RETRIES = 3

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Proxy setup ─────────────────────────────────────────────────────────
if PROXY_URL:
    proxy_handler = urllib.request.ProxyHandler({
        'http': PROXY_URL,
        'https': PROXY_URL,
    })
    opener = urllib.request.build_opener(proxy_handler)
else:
    opener = urllib.request.build_opener()

def fetch(url, timeout=30):
    """Fetch URL with proxy and retries."""
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            resp = opener.open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = (attempt + 1) * 3
                print(f'  Retry {attempt+1}/{MAX_RETRIES} after {wait}s: {e}')
                time.sleep(wait)
            else:
                print(f'  FAILED after {MAX_RETRIES} attempts: {e}')
                return None

# ── Step 1: Get ALL CDX entries ─────────────────────────────────────────
def get_cdx_entries():
    """Get all unique HTML product pages from CDX."""
    cache_file = os.path.join(OUTPUT_DIR, 'cdx_cache.json')
    if os.path.exists(cache_file):
        with open(cache_file) as f:
            return json.load(f)

    print('Querying CDX API for all acrnm.com HTML pages...')
    url = (f'{CDX_BASE}?url=acrnm.com/*&output=json'
           f'&fl=timestamp,original,statuscode,mimetype'
           f'&filter=statuscode:200&filter=mimetype:text/html')

    html = fetch(url, timeout=60)
    if not html:
        print('ERROR: Could not fetch CDX data')
        sys.exit(1)

    data = json.loads(html)
    rows = data[1:]  # skip header

    with open(cache_file, 'w') as f:
        json.dump(rows, f)

    print(f'  Got {len(rows)} unique HTML URLs')
    return rows

# ── Step 2: Identify all product pages ──────────────────────────────────
NON_PRODUCT_PATHS = {
    '/', '/agency', '/cancellation_policy', '/contact', '/fabrics', '/imprint',
    '/index', '/login', '/main.html', '/mainv.html', '/newsletter',
    '/privacy_policy', '/products', '/repairs', '/search', '/season',
    '/shipping', '/sizing', '/stockists', '/terms_and_conditions',
}

LOOKBOOK_PREFIXES = ['/lp0', '/lp1']

def is_product_page(path):
    """Determine if a URL path is a product page."""
    path = path.rstrip('/').lower()
    if path in NON_PRODUCT_PATHS:
        return False
    if any(path.startswith(p) for p in ['/pages/', '/account/', '/videos/', '/projects/', '/images/', '/cart']):
        return False
    if any(path.startswith(p) for p in LOOKBOOK_PREFIXES):
        return False
    if '/collections/' in path and '/products/' not in path:
        return False  # listing page, not product
    return True

def extract_product_slug(path):
    """Extract product slug from URL path."""
    path = path.rstrip('/')
    if '/products/' in path:
        return path.split('/products/')[-1].split('?')[0].split('#')[0]
    # Root-level: strip leading slashes
    slug = path.lstrip('/')
    if slug.startswith('/'):
        slug = slug.lstrip('/')
    return slug

def categorize_entries(rows):
    """Group CDX entries into product pages, collection listings, and other."""
    # For each unique product slug, keep the BEST snapshot:
    # - Prefer the latest capture (most complete data)
    # - For old-style slugs, prefer captures from the slug's era
    products = {}  # slug -> (timestamp, url)
    listings = {}  # path -> (timestamp, url)

    for row in rows:
        ts, url, status, mime = row
        parsed = urlparse(url)
        path = parsed.path.rstrip('/')
        if not path:
            path = '/'

        # Handle double-slash URLs
        while path.startswith('//'):
            path = path[1:]

        if '/collections/' in path and '/products/' not in path:
            norm = path.lower()
            if norm not in listings or ts > listings[norm][0]:
                listings[norm] = (ts, url)
        elif is_product_page(path):
            slug = extract_product_slug(path).lower()
            if slug and slug not in NON_PRODUCT_PATHS:
                if slug not in products or ts > products[slug][0]:
                    products[slug] = (ts, url)

    return products, listings

# ── Step 3: Parse product pages ─────────────────────────────────────────

def parse_old_era(html, url):
    """Parse old Shopify-era product page (2010-2017)."""
    data = {}

    # Name: <h1 itemprop="name"> or <h1>
    m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
    if m:
        data['name'] = m.group(1).strip()

    # Price
    m = re.search(r'[€$]\s*([\d,]+(?:\.\d{2})?)', html)
    if m:
        data['price'] = m.group(0).strip()

    # Currency
    if '€' in data.get('price', ''):
        data['currency'] = 'EUR'
    elif '$' in data.get('price', ''):
        data['currency'] = 'USD'

    # Images: various patterns
    images = set()
    # Shopify CDN pattern
    for m in re.finditer(r'(//cdn\.shopify\.com/s/files[^"\'>\s]+\.(?:jpg|jpeg|png|webp))', html):
        img = 'https:' + m.group(1) if m.group(1).startswith('//') else m.group(1)
        # Skip tiny thumbnails
        if 'icon' not in img.lower() and 'logo' not in img.lower():
            images.add(img)
    # Content images pattern
    for m in re.finditer(r'(/content/images/[^"\'>\s]+\.(?:jpg|jpeg|png|webp))', html):
        images.add(m.group(1))
    # Product image pattern
    for m in re.finditer(r'src=["\']([^"\']+/products/[^"\']+\.(?:jpg|jpeg|png|webp))', html):
        images.add(m.group(1))
    # Any other product images
    for m in re.finditer(r'src=["\']([^"\']+(?:jpg|jpeg|png|webp))["\']', html):
        img = m.group(1)
        if 'product' in img.lower() or 'acrnm' in img.lower():
            images.add(img)

    data['images'] = sorted(images)

    # Description
    desc_match = re.search(r'<div[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
    if desc_match:
        desc_html = desc_match.group(1)
        # Strip HTML tags
        desc = re.sub(r'<[^>]+>', ' ', desc_html).strip()
        desc = re.sub(r'\s+', ' ', desc)
        data['description'] = desc

    # Features / structured text
    features = []
    for m in re.finditer(r'<li[^>]*>([^<]+)</li>', html):
        feat = m.group(1).strip()
        if feat and len(feat) > 3:
            features.append(feat)
    if features:
        data['features'] = features

    return data

def parse_new_era(html, url):
    """Parse new Rails-era product page (2022+)."""
    data = {}

    # Name
    m = re.search(r'<h1[^>]*class="[^"]*product-overview__title[^"]*"[^>]*>([^<]+)</h1>', html)
    if not m:
        m = re.search(r'<h1[^>]*>([^<]+)</h1>', html)
    if m:
        data['name'] = m.group(1).strip()

    # Price
    m = re.search(r'Price:\s*([\d,]+(?:\.\d{2})?)\s*EUR', html)
    if m:
        data['price'] = f'€{m.group(1)}'
        data['currency'] = 'EUR'

    # Images: Active Storage proxy paths
    images = set()
    for m in re.finditer(r'(/rails/active_storage/representations/proxy/[^"\'>\s]+)', html):
        images.add(m.group(1))
    # Also check for direct image URLs
    for m in re.finditer(r'src=["\']([^"\']+\.(?:jpg|jpeg|png|webp|avif))["\']', html):
        img = m.group(1)
        if 'logo' not in img.lower() and 'icon' not in img.lower():
            images.add(img)

    data['images'] = sorted(images)

    # Description / product details
    desc_match = re.search(r'<div[^>]*class="[^"]*product-details[^"]*"[^>]*>(.*?)</div>', html, re.DOTALL)
    if desc_match:
        desc = re.sub(r'<[^>]+>', ' ', desc_match.group(1)).strip()
        desc = re.sub(r'\s+', ' ', desc)
        data['description'] = desc

    return data

def parse_product_page(html, url, timestamp):
    """Parse a product page, detecting era automatically."""
    year = int(timestamp[:4])

    if year >= 2022 and 'product-overview__title' in html:
        data = parse_new_era(html, url)
        data['era'] = 'new'
    else:
        data = parse_old_era(html, url)
        data['era'] = 'old'

    data['wayback_timestamp'] = timestamp
    data['source_url'] = url
    return data

# ── Step 4: Derive season from slug and capture year ────────────────────

def derive_season(slug, year):
    """Try to derive season from product slug or capture year."""
    slug_upper = slug.upper()

    # Explicit season in slug: MODEL_SEASON
    m = re.search(r'_(FW\d{2,4}|SS\d{2})$', slug_upper)
    if m:
        season = m.group(1)
        # Normalize: FW2223 → FW22, FW1314 → FW13
        if len(season) > 4:
            season = season[:4]
        return season

    # Season embedded in slug: p9-ch-ss13 → SS13, p10-s-fw1314 → FW13
    m = re.search(r'-(SS\d{2}|FW\d{2,4})(?:-|$)', slug_upper)
    if m:
        season = m.group(1)
        if len(season) > 4:
            season = season[:4]
        return season

    # Year suffix: 3a-1-2014 → need to figure out FW/SS
    m = re.search(r'-(\d{4})$', slug)
    if m:
        y = int(m.group(1))
        # Approximate: items added in first half = SS, second half = FW
        return f'FW{str(y)[-2:]}'  # conservative guess

    # No season info — derive from capture year
    # The Wayback capture year tells us roughly when it was on the site
    return None  # will need manual assignment

# ── Step 5: Process collection listing pages ────────────────────────────

def extract_products_from_listing(html, base_url):
    """Extract product links from a collection listing page."""
    products = set()

    # /collections/X/products/Y links
    for m in re.finditer(r'href=["\'](?:https?://[^/]+)?(/collections/[^/]+/products/([^"\'?#]+))', html):
        products.add(m.group(2).lower())

    # Direct /products/X links
    for m in re.finditer(r'href=["\'](?:https?://[^/]+)?/products/([^"\'?#]+)', html):
        products.add(m.group(1).lower())

    return products

# ── Main ────────────────────────────────────────────────────────────────

def main():
    # Get CDX data
    rows = get_cdx_entries()

    # Categorize
    products, listings = categorize_entries(rows)
    print(f'\nFound {len(products)} unique product pages, {len(listings)} collection listings')

    # Step A: Fetch collection listings to discover any products not in CDX
    print('\n=== Fetching collection listing pages ===')
    listing_products = set()
    for i, (path, (ts, url)) in enumerate(sorted(listings.items())):
        print(f'[{i+1}/{len(listings)}] {ts[:4]} {path}')
        wb_url = f'{WB_BASE}/{ts}id_/{url}'
        html = fetch(wb_url)
        if html:
            found = extract_products_from_listing(html, url)
            new = found - set(products.keys())
            listing_products.update(found)
            if new:
                print(f'  NEW products from listing: {new}')
        time.sleep(DELAY)

    print(f'\nTotal products from listings: {len(listing_products)}')
    new_from_listings = listing_products - set(products.keys())
    print(f'New products discovered from listings: {len(new_from_listings)}')
    for s in sorted(new_from_listings):
        print(f'  {s}')

    # Step B: For new products from listings, find their best CDX snapshot
    # We need to query CDX for each individually
    for slug in new_from_listings:
        print(f'\nLooking up CDX for: {slug}')
        cdx_url = (f'{CDX_BASE}?url=acrnm.com/*/products/{slug}&output=json'
                   f'&fl=timestamp,original,statuscode,mimetype'
                   f'&filter=statuscode:200&filter=mimetype:text/html'
                   f'&limit=1&sort=closest&from=20150101')
        resp = fetch(cdx_url, timeout=30)
        if resp:
            try:
                data = json.loads(resp)
                if len(data) > 1:
                    ts, url = data[1][0], data[1][1]
                    products[slug] = (ts, url)
                    print(f'  Found: {ts} {url}')
            except:
                pass
        time.sleep(DELAY)

    # Step C: Fetch all product pages
    print(f'\n=== Fetching {len(products)} product pages ===')
    results = []

    for i, (slug, (ts, url)) in enumerate(sorted(products.items())):
        # Check cache
        cache_file = os.path.join(OUTPUT_DIR, f'{slug.replace("/", "_")}.json')
        if os.path.exists(cache_file):
            with open(cache_file) as f:
                cached = json.load(f)
            results.append(cached)
            continue

        print(f'[{i+1}/{len(products)}] {ts[:4]} {slug}')
        wb_url = f'{WB_BASE}/{ts}id_/{url}'
        html = fetch(wb_url)

        if html:
            data = parse_product_page(html, url, ts)
            data['slug'] = slug
            data['season_derived'] = derive_season(slug, int(ts[:4]))

            # Save to cache
            with open(cache_file, 'w') as f:
                json.dump(data, f, indent=2)

            results.append(data)
            print(f'  {data.get("name", "?")} | {data.get("price", "?")} | {len(data.get("images", []))} imgs | season={data.get("season_derived", "?")}')
        else:
            print(f'  FAILED to fetch')

        time.sleep(DELAY)

    # Step D: Save full results
    output_file = os.path.join(OUTPUT_DIR, 'all_products.json')
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)

    print(f'\n=== SUMMARY ===')
    print(f'Total products scraped: {len(results)}')
    print(f'With images: {sum(1 for r in results if r.get("images"))}')
    print(f'With description: {sum(1 for r in results if r.get("description"))}')
    print(f'With season: {sum(1 for r in results if r.get("season_derived"))}')
    print(f'\nResults saved to: {output_file}')

    # Step E: Show what's new vs what we already have
    print(f'\n=== NEW PRODUCTS (not in existing CDX product set) ===')
    for slug in sorted(new_from_listings):
        matching = [r for r in results if r['slug'] == slug]
        if matching:
            r = matching[0]
            print(f'  {slug}: {r.get("name", "?")} | {r.get("price", "?")} | {len(r.get("images", []))} imgs')

if __name__ == '__main__':
    main()
