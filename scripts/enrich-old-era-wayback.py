#!/usr/bin/env python3
"""
Enrich early-era ACRONYM products from Wayback Machine.

1. Query CDX API for each model on acrnm.com
2. Fetch the best Wayback snapshot
3. Parse product data (name, price, description, features, images)
4. Write structured_data to Supabase
5. Save all results to /tmp/wayback-acrnm/old_products_enrichment.json
"""

import json, re, os, sys, time, traceback
from urllib.parse import urlparse, urlencode, quote
import urllib.request, urllib.error

# ── Config ───────────────────────────────────────────────────────────────────
PROXY_URL = 'http://oiDHj3tZvTPflP0w:6OMPPyyPUVuGuY8v@geo.iproyal.com:12321'
OUTPUT_DIR = '/tmp/wayback-acrnm'
CDX_BASE   = 'https://web.archive.org/cdx/search/cdx'
WB_BASE    = 'https://web.archive.org/web'
DELAY      = 1.5
MAX_RETRIES = 3

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://soowdirfqjwggvijdquz.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Proxy / HTTP helpers ─────────────────────────────────────────────────────
proxy_handler = urllib.request.ProxyHandler({
    'http': PROXY_URL,
    'https': PROXY_URL,
})
opener = urllib.request.build_opener(proxy_handler)

def fetch(url, timeout=30, use_proxy=True):
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            })
            resp = (opener if use_proxy else urllib.request.build_opener()).open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                wait = (attempt + 1) * 3
                print(f'  Retry {attempt+1}/{MAX_RETRIES} after {wait}s: {e}')
                time.sleep(wait)
            else:
                print(f'  FAILED: {e}')
                return None

def supabase_request(method, path, data=None):
    """Make a Supabase REST API request."""
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        print(f'  Supabase {method} {path}: HTTP {e.code}: {body[:200]}')
        return None
    except Exception as e:
        print(f'  Supabase error: {e}')
        return None

# ── Product database ─────────────────────────────────────────────────────────

# All products to enrich. Format: (name, season, source)
ACRNM_PRODUCTS = [
    # Early era (FW03-FW11) – NULL structured_data
    ('GT-J17', 'FW09', 'acrnm.com'),
    ('E-J3S',  'FW07', 'acrnm.com'),
    ('L-J1',   'FW05', 'acrnm.com'),
    ('J62-S',  'FW17', 'acrnm.com'),
    ('SM1-AM', 'FW17', 'acrnm.com'),
    ('GT-J9TS','FW05', 'acrnm.com'),
    ('SS-J7C', 'SS10', 'acrnm.com'),
    ('P10A-CH','FW17', 'acrnm.com'),
    ('GT-J18', 'FW11', 'acrnm.com'),
    ('SS-J3',  'SS07', 'acrnm.com'),
    ('L-J2',   'FW09', 'acrnm.com'),
    ('E-J2',   'FW06', 'acrnm.com'),
    ('SS-J4',  'FW06', 'acrnm.com'),
    ('GT-J10', 'FW06', 'acrnm.com'),
    ('SS-J6W', 'FW05', 'acrnm.com'),
    ('E-J1A',  'FW03', 'acrnm.com'),
    ('GT-J5',  'FW04', 'acrnm.com'),
    ('GT-J13', 'FW07', 'acrnm.com'),
    ('GT-J6',  'FW04', 'acrnm.com'),
    ('SS-J5',  'FW06', 'acrnm.com'),
    ('PL-J2',  'FW09', 'acrnm.com'),
    ('SS-JF1', 'FW11', 'acrnm.com'),
    ('S-J8',   'FW10', 'acrnm.com'),
    ('GT-J19', 'FW10', 'acrnm.com'),
    ('SS-J16', 'FW09', 'acrnm.com'),
    ('GT-J12', 'SS07', 'acrnm.com'),
    ('X-J13',  'SS11', 'acrnm.com'),
    ('SS-J12TS','FW09','acrnm.com'),
    ('S-J7',   'SS10', 'acrnm.com'),
    ('SS-J10', 'FW08', 'acrnm.com'),
    ('SS-J1',  'FW03', 'acrnm.com'),
    ('PL-J1',  'FW09', 'acrnm.com'),
    ('SS-J8',  'SS09', 'acrnm.com'),
]

# Secondary market items – try to find acrnm.com Wayback pages
SECONDARY_PRODUCTS = [
    # ebay
    ('J77-WS',  'FW19', 'ebay'),
    ('J56-S',   'FW17', 'ebay'),
    ('J50-GT',  'FW16', 'ebay'),
    ('J1E',     'SS20', 'ebay'),
    ('J2A-GT',  'FW11', 'ebay'),
    ('J3HY',    'FW08', 'ebay'),
    ('J64-TS',  'SS18', 'ebay'),
    ('J60-WS',  'FW17', 'ebay'),
    ('J99-GT',  'FW21', 'ebay'),
    ('J52-A',   'SS16', 'ebay'),
    ('J32-GT',  'FW13', 'ebay'),
    ('P40-DS',  'FW21', 'ebay'),
    ('J28-K',   'SS16', 'ebay'),
    ('J74-LP',  'FW19', 'ebay'),
    ('J48-CH',  'FW20', 'ebay'),
    ('J1TS-S',  'FW16', 'ebay'),
    ('J120-GT', 'SS23', 'ebay'),
    ('J80-PX',  'SS19', 'ebay'),
    ('J97-WS',  'FW21', 'ebay'),
    # grailed
    ('J110-GT', 'FW23', 'grailed'),
    ('J1TS-GT', 'FW16', 'grailed'),
    ('J107-GT', 'SS22', 'grailed'),
    ('S-J4TS',  'FW08', 'grailed'),
    ('GT-J11',  'FW06', 'grailed'),
    ('GT-J4',   'FW04', 'grailed'),
    ('GT-J15',  'FW08', 'grailed'),
    ('GT-J8',   'FW05', 'grailed'),
]

ALL_PRODUCTS = ACRNM_PRODUCTS + SECONDARY_PRODUCTS

# ── Season → Wayback year range mapping ─────────────────────────────────────

def season_to_years(season):
    """Return (from_year, to_year) range to search in CDX."""
    if not season:
        return (2005, 2023)
    m = re.match(r'(FW|SS)(\d{2})', season)
    if not m:
        return (2005, 2023)
    half, yy = m.group(1), int(m.group(2))
    year = 2000 + yy
    # The product would be on the site from its release through ~3 years later
    return (year, min(year + 4, 2023))

# ── Slug generation ──────────────────────────────────────────────────────────

def model_to_slugs(model, season):
    """Generate candidate URL slugs for a given model + season."""
    slugs = []
    m_lower = model.lower()

    # Old era URL patterns (pre-Shopify, direct root)
    slugs.append(m_lower)

    # Handle pre-FW1314 naming: GT-J17 → gt-j17
    # Also try without dash prefix: j17 (less likely)

    # Shopify /products/slug patterns
    slugs.append(f'collections/all/products/{m_lower}')
    slugs.append(f'collections/jackets/products/{m_lower}')
    slugs.append(f'collections/outerwear/products/{m_lower}')
    slugs.append(f'collections/new/products/{m_lower}')
    slugs.append(f'products/{m_lower}')

    # Season-suffixed patterns for Era 2 (FW16+)
    if season:
        sm = re.match(r'(FW|SS)(\d{2})', season)
        if sm:
            half, yy = sm.group(1), sm.group(2)
            year = 2000 + int(yy)
            if half == 'FW':
                next_yy = str(year + 1)[-2:]
                season_long = f'FW{yy}{next_yy}'   # e.g. FW1718
            else:
                season_long = f'SS{yy}'
            slugs.append(f'products/{m_lower}_{season_long}')
            slugs.append(f'products/{m_lower}_{season}')  # short e.g. FW17
            # also try without dash
            model_nodash = model.replace('-', '').lower()
            slugs.append(f'products/{model_nodash}_{season_long}')

    return slugs

# ── CDX search ───────────────────────────────────────────────────────────────

def cdx_search_model(model, season):
    """Search CDX for a model name, return list of (timestamp, url) tuples."""
    results = []

    # Strategy 1: wildcard search for the model code anywhere in URL
    model_encoded = quote(model, safe='')
    cdx_url = (f'{CDX_BASE}?url=acrnm.com/*{model_encoded}*'
               f'&output=json&fl=timestamp,original,statuscode'
               f'&filter=statuscode:200&collapse=urlkey&limit=50')

    print(f'  CDX wildcard search: {model}')
    resp = fetch(cdx_url, timeout=30, use_proxy=False)  # CDX doesn't need proxy
    if resp:
        try:
            rows = json.loads(resp)
            for row in rows[1:]:  # skip header
                ts, url = row[0], row[1]
                # Only keep HTML product pages
                parsed = urlparse(url)
                path = parsed.path.lower()
                if any(x in path for x in ['.js', '.css', '.json', '.xml', '.txt', 'robots', 'sitemap']):
                    continue
                results.append((ts, url))
        except Exception as e:
            print(f'    CDX parse error: {e}')

    # Also try lowercase model
    model_lower = model.lower()
    if model_lower != model:
        cdx_url2 = (f'{CDX_BASE}?url=acrnm.com/*{quote(model_lower, safe="")}*'
                    f'&output=json&fl=timestamp,original,statuscode'
                    f'&filter=statuscode:200&collapse=urlkey&limit=50')
        resp2 = fetch(cdx_url2, timeout=30, use_proxy=False)
        if resp2 and resp2 != resp:
            try:
                rows2 = json.loads(resp2)
                for row in rows2[1:]:
                    ts, url = row[0], row[1]
                    parsed = urlparse(url)
                    path = parsed.path.lower()
                    if any(x in path for x in ['.js', '.css', '.json', '.xml', '.txt']):
                        continue
                    if (ts, url) not in results:
                        results.append((ts, url))
            except:
                pass

    time.sleep(0.5)
    return results

# ── HTML parser ──────────────────────────────────────────────────────────────

def clean_html(text):
    """Strip HTML tags and normalize whitespace."""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_old_html(html, url, timestamp):
    """Parse pre-Shopify / early Shopify ACRONYM product pages."""
    data = {}

    # ── Name ──────────────────────────────────────────────────────────────
    for pat in [
        r'<h1[^>]*itemprop="name"[^>]*>([^<]+)</h1>',
        r'<h1[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)</h1>',
        r'<h1[^>]*>([^<]+)</h1>',
        r'<title>([^<|–]+)',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            name = clean_html(m.group(1)).strip()
            if name and len(name) > 2 and name.lower() not in ('acrnm', 'acronym', 'home'):
                data['name'] = name
                break

    # ── Price ─────────────────────────────────────────────────────────────
    for pat in [
        r'itemprop="price"[^>]*content="([\d.]+)"',
        r'<span[^>]*class="[^"]*price[^"]*"[^>]*>\s*[€$£]([\d,]+(?:\.\d{2})?)',
        r'[€$£]\s*([\d,]+(?:\.\d{2})?)',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            try:
                price_num = float(m.group(1).replace(',', ''))
                currency_m = re.search(r'([€$£])', html)
                currency_sym = currency_m.group(1) if currency_m else '€'
                data['price'] = f'{currency_sym}{price_num:.2f}'
                data['currency'] = {'€': 'EUR', '$': 'USD', '£': 'GBP'}.get(currency_sym, 'EUR')
            except:
                pass
            break

    # ── Description ───────────────────────────────────────────────────────
    desc_patterns = [
        r'<div[^>]*class="[^"]*product[_-]?description[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*id="[^"]*description[^"]*"[^>]*>(.*?)</div>',
        r'<div[^>]*class="[^"]*description[^"]*"[^>]*>(.*?)</div>',
        r'<p[^>]*itemprop="description"[^>]*>(.*?)</p>',
        # Very old acrnm.com style: centered block text
        r'<td[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</td>',
        # Fallback: longest <p> that looks product-y
    ]
    for pat in desc_patterns:
        m = re.search(pat, html, re.IGNORECASE | re.DOTALL)
        if m:
            desc = clean_html(m.group(1))
            if len(desc) > 30:
                data['description'] = desc
                break

    # If still no description, try finding the biggest paragraph
    if 'description' not in data:
        paras = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL | re.IGNORECASE)
        best = ''
        for p in paras:
            text = clean_html(p)
            if len(text) > len(best) and len(text) > 50:
                # Skip nav/footer paragraphs
                if not any(x in text.lower() for x in ['copyright', 'all rights', 'privacy', 'cookie', 'javascript']):
                    best = text
        if best:
            data['description'] = best

    # ── Features (bullet list) ─────────────────────────────────────────────
    features = []
    for m in re.finditer(r'<li[^>]*>(.*?)</li>', html, re.DOTALL | re.IGNORECASE):
        feat = clean_html(m.group(1)).strip()
        if feat and len(feat) > 5 and len(feat) < 300:
            # Skip nav items
            if not any(x in feat.lower() for x in ['home', 'contact', 'about', 'login', 'cart', 'wishlist', 'account']):
                features.append(feat)
    if features:
        data['features'] = features

    # ── Images ────────────────────────────────────────────────────────────
    images = []
    seen = set()

    # Shopify CDN
    for m in re.finditer(r'(https?://cdn\.shopify\.com/s/files/[^\s"\'<>]+\.(?:jpg|jpeg|png|webp))', html, re.IGNORECASE):
        img = m.group(1)
        # Remove size modifiers
        img = re.sub(r'_\d+x\d*\.', '.', img)
        img = re.sub(r'\?.*$', '', img)
        if img not in seen and 'icon' not in img.lower() and 'logo' not in img.lower():
            seen.add(img)
            images.append(img)

    # Also protocol-relative
    for m in re.finditer(r'(//cdn\.shopify\.com/s/files/[^\s"\'<>]+\.(?:jpg|jpeg|png|webp))', html, re.IGNORECASE):
        img = 'https:' + m.group(1)
        img = re.sub(r'_\d+x\d*\.', '.', img)
        img = re.sub(r'\?.*$', '', img)
        if img not in seen and 'icon' not in img.lower() and 'logo' not in img.lower():
            seen.add(img)
            images.append(img)

    # Old-style acrnm.com /content/images/ or relative images
    for m in re.finditer(r'src=["\']([^"\']+\.(?:jpg|jpeg|png|gif))["\']', html, re.IGNORECASE):
        img = m.group(1)
        if img.startswith('//'):
            img = 'https:' + img
        elif img.startswith('/'):
            img = 'https://acrnm.com' + img
        elif not img.startswith('http'):
            continue
        if img not in seen and 'icon' not in img.lower() and 'logo' not in img.lower():
            # Filter out tracker pixels, UI images
            if any(x in img for x in ['/products/', '/content/', 'cdn.shopify', 'acrnm']):
                seen.add(img)
                images.append(img)

    if images:
        data['images'] = images

    # ── Materials ─────────────────────────────────────────────────────────
    materials = []
    for pat in [
        r'(?:fabric|material|shell|lining):\s*([^\n<]{5,100})',
        r'(\d+%\s*(?:polyester|nylon|cotton|merino|wool|gore-tex|pertex)[^\n<]{0,60})',
    ]:
        for m in re.finditer(pat, html, re.IGNORECASE):
            mat = clean_html(m.group(1)).strip()
            if mat and mat not in materials:
                materials.append(mat)
    if materials:
        data['materials'] = materials

    # ── Weight ────────────────────────────────────────────────────────────
    m = re.search(r'(\d+(?:\.\d+)?)\s*g(?:ram)?s?\b', html, re.IGNORECASE)
    if m:
        data['weight_grams'] = int(float(m.group(1)))

    return data

def parse_shopify_json(html):
    """Try to extract Shopify product JSON from page source."""
    for pat in [
        r'var\s+meta\s*=\s*(\{.*?"product".*?\})\s*;',
        r'window\.ShopifyAnalytics\.meta\s*=\s*(\{.*?\})\s*;',
        r'<script[^>]*type="application/json"[^>]*>(\{"product"[^<]+)</script>',
        r'"product":\s*(\{[^<]{100,}?\})\s*[,}]',
    ]:
        m = re.search(pat, html, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(1))
                # Navigate to product key
                if 'product' in obj:
                    return obj['product']
                return obj
            except:
                pass

    # Try JSON-LD
    for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL):
        try:
            obj = json.loads(m.group(1))
            if isinstance(obj, dict) and obj.get('@type') == 'Product':
                return obj
        except:
            pass

    return None

def extract_structured_data(html, url, timestamp, model, season):
    """Extract structured product data from HTML."""
    # Try Shopify JSON first
    shopify = parse_shopify_json(html)
    data = {}

    if shopify:
        data['_source'] = 'shopify_json'
        if 'title' in shopify:
            data['name'] = shopify['title']
        if 'body_html' in shopify:
            data['description'] = clean_html(shopify['body_html'])
        if 'variants' in shopify and shopify['variants']:
            v = shopify['variants'][0]
            if 'price' in v:
                data['price'] = f"€{float(v['price']):.2f}"
                data['currency'] = 'EUR'
        if 'images' in shopify:
            data['images'] = [img.get('src', '') for img in shopify['images'] if img.get('src')]

    # Parse HTML for anything missing
    html_data = parse_old_html(html, url, timestamp)
    for key, val in html_data.items():
        if key not in data or not data[key]:
            data[key] = val

    # Add model and season
    data['model'] = model
    data['season'] = season
    data['wayback_url'] = url
    data['wayback_timestamp'] = timestamp
    data['scraped_at'] = '2026-04-12'

    return data

# ── Style/category inference ─────────────────────────────────────────────────

def infer_style_category(model):
    """Infer acronym_style and acronym_category from model code."""
    prefix = model.upper().split('-')[0]

    style_map = {
        'GT':  'Hardshell / Waterproof',
        'SS':  'Softshell / Water Resistant',
        'E':   'NTS / Next to Skin',
        'L':   'Lightshell',
        'PL':  'Lightshell',
        'S':   'Softshell',
        'DS':  'NTS',
        'X':   'Special Projects',
        'SM':  'NTS',
        'KR':  'NTS',
    }

    category_map = {
        'J':  'Jacket',
        'P':  'Pant',
        'TS': 'T-Shirt',
        'S':  'Shirt',
        'V':  'Vest',
        'H':  'Hoodie',
        'K':  'Knitwear',
        'WS': 'Windshell',
        'LP': 'Lightpant',
        'PX': 'Pants with expansion',
    }

    acronym_style = style_map.get(prefix, None)

    # Category from model body (after the prefix-dash)
    parts = model.upper().split('-')
    if len(parts) > 1:
        body = parts[1]
        # Extract letter part of model number
        letter_part = re.match(r'([A-Z]+)', body)
        if letter_part:
            cat_code = letter_part.group(1)
            acronym_category = category_map.get(cat_code, None)
            if not acronym_category:
                # Check if J is in the code
                if 'J' in cat_code:
                    acronym_category = 'Jacket'
                elif 'P' in cat_code:
                    acronym_category = 'Pant'
        else:
            acronym_category = None
    else:
        acronym_category = None

    # Special cases
    if model.upper().startswith('P10A'):
        acronym_category = 'Pant'
        acronym_style = 'Water Resistant'
    if 'SM' in model.upper() and 'M' in model.upper():
        acronym_category = 'Mask'

    return acronym_style, acronym_category

# ── Main enrichment loop ─────────────────────────────────────────────────────

def load_existing_db_objects(models):
    """Fetch existing DB rows for these models."""
    # Query Supabase for objects matching these model names
    # Use name ilike pattern to find them
    model_list = ','.join(f'"{m}"' for m in models)
    path = f'objects?select=id,name,season,structured_data,acronym_style,acronym_category,source_site&name=in.({",".join(models)})&limit=200'

    # Use a POST with filters since model names have special chars
    result = supabase_request('GET', f'objects?select=id,name,season,structured_data,acronym_style,acronym_category,source_site&limit=200')
    return result or []

def fetch_objects_by_names(names):
    """Fetch DB objects matching any of these names."""
    if not SUPABASE_KEY:
        print('WARNING: No SUPABASE_SERVICE_KEY set, skipping DB queries')
        return []

    all_rows = []
    # Batch in groups of 20
    for i in range(0, len(names), 20):
        batch = names[i:i+20]
        # URL-encode the filter
        name_filter = ','.join(batch)
        encoded = quote(name_filter, safe=',-')
        path = f'objects?select=id,name,season,structured_data,acronym_style,acronym_category,source_site&name=in.({encoded})&limit=100'
        result = supabase_request('GET', path)
        if result:
            all_rows.extend(result)
        time.sleep(0.2)
    return all_rows

def update_object_in_db(obj_id, structured_data, acronym_style, acronym_category):
    """PATCH an object in Supabase with enriched data."""
    if not SUPABASE_KEY:
        return False

    patch_data = {}
    if structured_data:
        patch_data['structured_data'] = structured_data
    if acronym_style:
        patch_data['acronym_style'] = acronym_style
    if acronym_category:
        patch_data['acronym_category'] = acronym_category

    if not patch_data:
        return False

    result = supabase_request('PATCH', f'objects?id=eq.{obj_id}', patch_data)
    return result is not None

def main():
    print('=== ACRONYM Wayback Enrichment ===')
    print(f'Products to process: {len(ALL_PRODUCTS)}')
    print()

    # Load existing DB objects
    all_names = [p[0] for p in ALL_PRODUCTS]
    print(f'Fetching DB objects for {len(all_names)} model names...')
    db_objects = fetch_objects_by_names(all_names)
    print(f'Found {len(db_objects)} matching DB rows')

    # Index by name
    db_by_name = {}
    for obj in db_objects:
        name = obj.get('name', '')
        if name not in db_by_name:
            db_by_name[name] = []
        db_by_name[name].append(obj)

    enrichment_results = []
    updated_count = 0
    failed_count = 0
    not_found_count = 0

    for idx, (model, season, source) in enumerate(ALL_PRODUCTS):
        print(f'\n[{idx+1}/{len(ALL_PRODUCTS)}] {model} {season} ({source})')

        # Check for existing cache
        cache_key = f'{model.lower().replace("-", "")}_{season.lower()}'
        html_cache = os.path.join(OUTPUT_DIR, f'html_{model.lower()}_{season.lower()}.html')
        json_cache = os.path.join(OUTPUT_DIR, f'parsed_{model.lower()}_{season.lower()}.json')

        parsed_data = None

        # Load from HTML cache if exists
        if os.path.exists(html_cache):
            print(f'  Using cached HTML: {html_cache}')
            with open(html_cache) as f:
                cached_html = f.read()
            # Re-parse from cache
            parsed_data = extract_structured_data(
                cached_html,
                f'https://acrnm.com/{model.lower()}',
                '20100101000000',
                model, season
            )
        elif os.path.exists(json_cache):
            print(f'  Using cached JSON: {json_cache}')
            with open(json_cache) as f:
                parsed_data = json.load(f)
        else:
            # CDX search
            cdx_results = cdx_search_model(model, season)

            if not cdx_results:
                print(f'  No CDX results found')
                not_found_count += 1
                enrichment_results.append({
                    'model': model, 'season': season, 'source': source,
                    'status': 'not_found', 'cdx_results': 0,
                })
                continue

            print(f'  CDX results: {len(cdx_results)} URLs')
            for ts, url in cdx_results[:5]:
                print(f'    {ts[:8]} {url}')

            # Pick best snapshot: prefer one from the right era
            from_year, to_year = season_to_years(season)

            # Sort by preference: closest to product era, then latest
            def score(r):
                ts, url = r
                y = int(ts[:4])
                # Prefer /products/ URLs
                product_bonus = 100 if '/products/' in url.lower() else 0
                # Prefer era match
                era_score = 50 - abs(y - from_year)
                return product_bonus + era_score

            cdx_results.sort(key=score, reverse=True)
            best_ts, best_url = cdx_results[0]

            print(f'  Best snapshot: {best_ts[:8]} {best_url}')

            # Fetch via Wayback
            wb_url = f'{WB_BASE}/{best_ts}id_/{best_url}'
            html = fetch(wb_url)

            if not html:
                print(f'  FAILED to fetch HTML')
                failed_count += 1
                enrichment_results.append({
                    'model': model, 'season': season, 'source': source,
                    'status': 'fetch_failed', 'wayback_url': best_url,
                })
                continue

            # Save HTML cache
            with open(html_cache, 'w') as f:
                f.write(html)

            # Parse
            parsed_data = extract_structured_data(html, best_url, best_ts, model, season)

            # Save parsed cache
            with open(json_cache, 'w') as f:
                json.dump(parsed_data, f, indent=2)

            time.sleep(DELAY)

        if not parsed_data:
            failed_count += 1
            continue

        # Determine style and category
        acronym_style, acronym_category = infer_style_category(model)

        print(f'  Name: {parsed_data.get("name", "?")}')
        print(f'  Price: {parsed_data.get("price", "?")}')
        print(f'  Images: {len(parsed_data.get("images", []))}')
        print(f'  Description len: {len(parsed_data.get("description", ""))}')
        print(f'  Style: {acronym_style} | Category: {acronym_category}')

        # Find matching DB objects
        matching_objs = db_by_name.get(model, [])

        # Also try without season filter – pick the right season
        season_matching = [o for o in matching_objs if o.get('season') == season]
        target_objs = season_matching if season_matching else matching_objs

        result_entry = {
            'model': model,
            'season': season,
            'source': source,
            'status': 'parsed',
            'parsed_data': parsed_data,
            'acronym_style': acronym_style,
            'acronym_category': acronym_category,
            'db_matches': len(target_objs),
            'db_updated': [],
        }

        # Write to DB
        for obj in target_objs:
            obj_id = obj['id']
            obj_name = obj.get('name', '')

            # Only update if structured_data is NULL or empty
            if obj.get('structured_data') and not any(
                k in str(obj.get('structured_data', {}))
                for k in ['wayback', 'scraped']
            ):
                print(f'  DB row {obj_id} ({obj_name}) already has structured_data, enriching anyway')

            success = update_object_in_db(obj_id, parsed_data, acronym_style, acronym_category)
            if success:
                print(f'  ✓ Updated DB row {obj_id} ({obj_name} {obj.get("season", "")})')
                updated_count += 1
                result_entry['db_updated'].append(obj_id)
            else:
                print(f'  ✗ Failed to update DB row {obj_id}')
                failed_count += 1

        if not target_objs:
            print(f'  No matching DB rows for {model} {season}')

        enrichment_results.append(result_entry)

    # Save results
    output_file = os.path.join(OUTPUT_DIR, 'old_products_enrichment.json')
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total': len(ALL_PRODUCTS),
                'updated': updated_count,
                'failed': failed_count,
                'not_found': not_found_count,
                'run_at': '2026-04-12',
            },
            'results': enrichment_results,
        }, f, indent=2)

    print(f'\n=== SUMMARY ===')
    print(f'Total products: {len(ALL_PRODUCTS)}')
    print(f'DB rows updated: {updated_count}')
    print(f'Not found in Wayback: {not_found_count}')
    print(f'Fetch/parse failures: {failed_count}')
    print(f'\nResults saved to: {output_file}')

if __name__ == '__main__':
    main()
