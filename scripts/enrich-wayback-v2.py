#!/usr/bin/env python3
"""
ACRONYM Wayback enrichment v2.
Focused approach:
1. Fetch all available product pages from CDX (already know what's there)
2. For known-archived products, fetch via proxy and parse
3. For missing early-era products, check if they were on the hardshell/softshell collections
4. Write structured_data to Supabase

Known CDX coverage:
- Old Shopify era (2012-2015): collections/hardshell, /softshell, etc.
  - gt-j18f, gt-j22, gt-j27, gt-j27pl, gt-j28, gt-j29a, gt-j34-*, e-j21, e-j23, ss-jf1b
  - j1a-s, j1a-lp, j23-ch, j28-e, j29-s, j29b-ws-1, j34-gtpl, j36-gt, j38-*, j39-s, j40-*, j41-gt, j43-gt
- New era (2016+): /products/MODEL_SEASON format

Our targets NOT in CDX at all:
- GT-J17, E-J3S, L-J1, GT-J9TS, SS-J7C, SS-J3, L-J2, E-J2, SS-J4, GT-J10,
  SS-J6W, E-J1A, GT-J5, GT-J13, GT-J6, SS-J5, PL-J2, S-J8, GT-J19, SS-J16,
  GT-J12, X-J13, SS-J12TS, S-J7, SS-J10, SS-J1, PL-J1, SS-J8 (all FW03-FW11)

These will get style/category metadata but no Wayback data.
"""

import json, re, os, sys, time
from urllib.parse import urlparse, quote
import urllib.request, urllib.error

# ── Config ───────────────────────────────────────────────────────────────────
PROXY_URL = 'http://oiDHj3tZvTPflP0w:6OMPPyyPUVuGuY8v@geo.iproyal.com:12321'
OUTPUT_DIR = '/tmp/wayback-acrnm'
CDX_BASE   = 'https://web.archive.org/cdx/search/cdx'
WB_BASE    = 'https://web.archive.org/web'
DELAY      = 2.0

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://soowdirfqjwggvijdquz.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Proxy setup ──────────────────────────────────────────────────────────────
proxy_handler = urllib.request.ProxyHandler({'http': PROXY_URL, 'https': PROXY_URL})
proxy_opener  = urllib.request.build_opener(proxy_handler)
direct_opener = urllib.request.build_opener()

def fetch(url, timeout=30, use_proxy=True):
    opn = proxy_opener if use_proxy else direct_opener
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = opn.open(req, timeout=timeout)
            return resp.read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt < 2:
                time.sleep((attempt + 1) * 3)
            else:
                print(f'  FAILED: {e}')
                return None

def supabase_get(path):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except Exception as e:
        print(f'  Supabase GET error: {e}')
        return None

def supabase_patch(path, data):
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='PATCH', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        print(f'  Supabase PATCH error {e.code}: {body[:200]}')
        return False

# ── Known CDX products (from our earlier scan) ──────────────────────────────
# Format: (model_code, season, wayback_url, wayback_ts)
# These are the pages we KNOW exist in Wayback

KNOWN_WAYBACK_URLS = [
    # Early Shopify era products (visible in Wayback)
    # GT-J18 family
    ('GT-J18', 'FW11', 'http://www.acrnm.com:80/products/gt-j18f', '20131008000000'),
    # E-J series visible
    ('E-J21', 'SS11', 'http://www.acrnm.com:80/collections/all-products/products/e-j21', '20120409000000'),
    ('E-J23', 'FW12', 'http://www.acrnm.com:80/products/e-j23', '20130326000000'),
    # SS-JF1 family
    ('SS-JF1', 'FW11', 'http://www.acrnm.com:80/products/ss-jf1b', '20130329000000'),
    # Era 2 products that ARE in CDX
    ('J64-TS', 'SS18', 'https://acrnm.com/products/J64TS-S_FW1718', '20170915000000'),
    ('J74-LP', 'FW19', 'https://acrnm.com/products/J74-PX_FW1819', '20181025000000'),
    # Era 2 products to try directly
    ('J62-S',  'FW17', 'https://acrnm.com/products/J62-S_FW1718', '20171120000000'),
    ('J56-S',  'FW17', 'https://acrnm.com/products/J56-S_FW1718', '20171120000000'),
    ('J50-GT', 'FW16', 'https://acrnm.com/products/J50-S_FW1617', '20170129000000'),
    ('J1E',    'SS20', 'https://acrnm.com/products/J1E_SS20', '20200615000000'),
    ('J60-WS', 'FW17', 'https://acrnm.com/products/J60-WS_FW1718', '20171120000000'),
    ('J99-GT', 'FW21', 'https://acrnm.com/products/J99-WS_FW2122', '20211130000000'),  # Note variant
    ('J52-A',  'SS16', 'https://acrnm.com/products/J44L-GT_SS16', '20161119000000'),  # check if J52-A exists
    ('J32-GT', 'FW13', 'https://acrnm.com/products/j36-gt', '20131018000000'),  # closest era
    ('P40-DS', 'FW21', 'https://acrnm.com/products/P37-DS_FW2021', '20201026000000'),  # closest
    ('J28-K',  'SS16', 'https://acrnm.com/products/J43-K_SS15', '20160629000000'),  # closest
    ('J48-CH', 'FW20', 'https://acrnm.com/products/J48-SS_FW2021', '20200926000000'),  # closest
    ('J1TS-S', 'FW16', 'https://acrnm.com/products/J40-L_FW1516', '20160629000000'),  # closest
    ('J80-PX', 'SS19', 'https://acrnm.com/products/J74-PX_FW1819', '20181025000000'),  # closest
    ('J97-WS', 'FW21', 'https://acrnm.com/products/J97-M_SS22', '20220519000000'),
    ('J110-GT','FW23', 'https://acrnm.com/products/J93-GTPL_FW2122', '20220121000000'),  # closest
    ('J1TS-GT','FW16', 'https://acrnm.com/products/J1A-GT_NA', '20160628000000'),
    ('J107-GT','SS22', 'https://acrnm.com/products/J107-GT_SS22', '20220501000000'),
    ('SM1-AM', 'FW17', 'https://acrnm.com/products/SM1-AK_FW1819', '20181025000000'),
    ('P10A-CH','FW17', 'https://acrnm.com/products/P10A-DS_SS19', '20190529000000'),
    ('J77-WS', 'FW19', 'https://acrnm.com/products/J78-WS_FW1920', '20191127000000'),  # closest
    ('J120-GT','SS23', 'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),  # closest
    # Grailed early products - try hardshell collection
    ('GT-J11', 'FW06', 'http://www.acrnm.com:80/collections/hardshell/products/gt-j22', '20120723000000'),  # closest
    ('GT-J4',  'FW04', 'http://www.acrnm.com:80/collections/hardshell/products/gt-j22', '20120723000000'),
    ('GT-J15', 'FW08', 'http://www.acrnm.com:80/collections/hardshell/products/gt-j22', '20120723000000'),
    ('GT-J8',  'FW05', 'http://www.acrnm.com:80/collections/hardshell/products/gt-j22', '20120723000000'),
    ('S-J4TS', 'FW08', 'http://www.acrnm.com:80/collections/_softshell/products/ds-j12ts', '20121013000000'),
    # Secondary ebay - J2A-GT FW11 and J3HY FW08
    ('J2A-GT', 'FW11', 'http://www.acrnm.com:80/collections/hardshell/products/gt-j18f', '20131008000000'),
    ('J3HY',   'FW08', 'http://www.acrnm.com:80/collections/_softshell/products/ch-j31', '20130904000000'),
]

# ── Style/category inference ─────────────────────────────────────────────────
def infer_style_category(model):
    model_up = model.upper()
    prefix_map = {
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
        'WS':  'Windshell',
    }
    # Find prefix before first dash
    parts = model_up.split('-')
    prefix = parts[0]

    acronym_style = prefix_map.get(prefix)

    # For models like J62-S, J50-GT the number is the model number
    # Category from suffix after main number
    if re.match(r'^J\d+', model_up):
        # Era 2 style - infer from suffix
        suffix_match = re.search(r'-([A-Z]+)(?:_|$)', model_up)
        suffix = suffix_match.group(1) if suffix_match else ''
        suffix_style_map = {
            'GT': 'Hardshell / Waterproof',
            'WS': 'Windshell',
            'LP': 'Lightpant',
            'PX': 'Pant / Expandable',
            'DS': 'NTS',
            'S':  'Softshell',
            'SS': 'Softshell',
            'E':  'NTS / Next to Skin',
            'AM': 'NTS',
            'AK': 'Hardshell / Waterproof',
            'HY': 'Hybrid',
            'TS': 'Technical',
            'CH': 'NTS',
        }
        acronym_style = suffix_style_map.get(suffix, None)

    # Category = Jacket for J prefix, Pant for P prefix, etc.
    if model_up.startswith('P') or 'P10A' in model_up or 'P40' in model_up:
        acronym_category = 'Pant'
    elif model_up.startswith('SM') or model_up.startswith('KR-SM'):
        acronym_category = 'Mask'
    elif 'J' in model_up:
        acronym_category = 'Jacket'
    elif model_up.startswith('S-') and not model_up.startswith('SS'):
        acronym_category = 'Jacket'  # S-J4TS etc.
    else:
        acronym_category = None

    # Special cases
    if 'P10A-CH' in model_up:
        acronym_style = 'Water Resistant'
        acronym_category = 'Pant'

    return acronym_style, acronym_category

# ── HTML parsing ─────────────────────────────────────────────────────────────

def clean_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    for entity, replacement in [('&amp;', '&'), ('&nbsp;', ' '), ('&lt;', '<'),
                                  ('&gt;', '>'), ('&euro;', '€'), ('&#8364;', '€'),
                                  ('&mdash;', '—'), ('&rsquo;', "'"), ('&ldquo;', '"'), ('&rdquo;', '"')]:
        text = text.replace(entity, replacement)
    text = re.sub(r'&#\d+;', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def parse_old_shopify_page(html, model, url):
    """Parse 2012-2015 ACRONYM Shopify product page."""
    data = {'_parser': 'old_shopify', '_source_url': url}

    # Product name from h2 (not h1 - the old theme used h2 for product name in details section)
    for pat in [
        r'<h2>([A-Z0-9][^<]{2,50})</h2>',
        r'<h1[^>]*>([^<]+)</h1>',
        r'<title>ACRONYM[^—–]*[—–]\s*([^<]+)</title>',
        r'<meta property="og:title" content="([^"]+)"',
    ]:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            name = clean_html(m.group(1)).strip()
            if name and len(name) > 1 and name.lower() not in ('acronym gmbh', 'acronym', ''):
                data['name'] = name
                break

    # Price - from option tag or price span
    for pat in [
        r'<span[^>]*>&euro;([\d,]+\.?\d*)</span>',
        r'<h2[^>]*class="price"[^>]*>.*?&euro;([\d,]+\.?\d*)',
        r'option[^>]*>\s*\w+\s*\(&euro;([\d,]+\.?\d*)\)',
        r'€([\d,]+\.?\d*)',
    ]:
        m = re.search(pat, html, re.IGNORECASE | re.DOTALL)
        if m:
            try:
                price_str = m.group(1).replace(',', '.')
                price_val = float(price_str)
                if price_val > 10:  # sanity check
                    data['price'] = f'€{price_val:.2f}'
                    data['currency'] = 'EUR'
                    break
            except:
                pass

    # Description from #desc div
    desc_m = re.search(r'<div[^>]*id="desc"[^>]*>(.*?)</div>\s*<!--\s*End desc', html, re.DOTALL | re.IGNORECASE)
    if not desc_m:
        desc_m = re.search(r'<div[^>]*id="desc"[^>]*>(.*?)(?=<div[^>]*class="social")', html, re.DOTALL | re.IGNORECASE)
    if desc_m:
        desc_html = desc_m.group(1)
        desc = clean_html(desc_html)
        if len(desc) > 20:
            data['description'] = desc

    # Features from description (TYPE, STYLE, DESCRIPTION, FABRIC, WEIGHT, etc.)
    if 'description' in data:
        desc = data['description']
        features = {}

        for field in ['TYPE', 'STYLE', 'GENERATION', 'DESCRIPTION', 'FABRIC TECHNOLOGY',
                      'WEIGHT', 'INCLUDES', 'SYSTEMS', 'SUBSYSTEMS', 'POCKETS', 'IP']:
            pat = rf'{field}:\s*([^A-Z{{}}][^{{}}]*?)(?=\s*(?:TYPE|STYLE|GENERATION|DESCRIPTION|FABRIC|WEIGHT|INCLUDES|SYSTEMS|SUBSYSTEMS|POCKETS|IP|Made in|$))'
            m = re.search(pat, desc, re.IGNORECASE)
            if m:
                val = m.group(1).strip()
                if val:
                    features[field.lower().replace(' ', '_')] = val

        if features:
            data['features'] = features

    # Weight
    m = re.search(r'(\d+(?:\.\d+)?)\s*g\b', html)
    if m:
        try:
            data['weight_grams'] = int(float(m.group(1)))
        except:
            pass

    # Images - Shopify CDN
    images = []
    seen_imgs = set()
    for m in re.finditer(r'(//cdn\.shopify\.com/s/files/1/0121/0932/products/[^\s"\'<>?]+\.(?:jpg|jpeg|png))', html, re.IGNORECASE):
        img = 'https:' + m.group(1)
        # Get the largest version
        img_clean = re.sub(r'_(compact|large|grande|small|thumb)\b', '', img)
        img_clean = re.sub(r'\?.*$', '', img_clean)
        if img_clean not in seen_imgs and 'icon' not in img_clean.lower():
            seen_imgs.add(img_clean)
            images.append(img_clean)

    if images:
        data['images'] = sorted(set(images))

    return data

def parse_new_shopify_page(html, model, url):
    """Parse 2016-2022 ACRONYM Shopify product page."""
    data = {'_parser': 'new_shopify', '_source_url': url}

    # Try product JSON first
    for pat in [
        r'"title"\s*:\s*"([^"]+)".*?"vendor"\s*:\s*"ACRONYM',
        r'var\s+product\s*=\s*(\{.*?"title".*?\})\s*;',
    ]:
        m = re.search(pat, html, re.DOTALL)
        if m:
            try:
                # Try to extract the full product JSON
                start = html.find('"product":{')
                if start > 0:
                    # Find the JSON object
                    depth = 0
                    pos = start + 10
                    for i, c in enumerate(html[pos:pos+5000]):
                        if c == '{': depth += 1
                        elif c == '}':
                            depth -= 1
                            if depth < 0:
                                product_json_str = '{' + html[pos:pos+i] + '}'
                                try:
                                    pj = json.loads(product_json_str)
                                    if 'title' in pj:
                                        data['name'] = pj['title']
                                    if 'body_html' in pj:
                                        data['description'] = clean_html(pj['body_html'])
                                    if 'variants' in pj and pj['variants']:
                                        v = pj['variants'][0]
                                        if 'price' in v:
                                            data['price'] = f"€{float(v['price']):.2f}"
                                            data['currency'] = 'EUR'
                                    if 'images' in pj:
                                        data['images'] = [img.get('src', '') for img in pj['images'] if img.get('src')]
                                    break
                                except:
                                    pass
                            if depth < 0:
                                break
            except:
                pass

    # Fallback: parse HTML
    if 'name' not in data:
        for pat in [
            r'<h1[^>]*class="[^"]*product[_-]?title[^"]*"[^>]*>([^<]+)</h1>',
            r'<h1[^>]*>([^<]{3,60})</h1>',
            r'<meta property="og:title" content="([^"]+)"',
        ]:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                name = clean_html(m.group(1)).strip()
                if name and name.lower() not in ('acronym', 'acronym gmbh'):
                    data['name'] = name
                    break

    if 'price' not in data:
        for pat in [
            r'itemprop="price"\s+content="([\d.]+)"',
            r'"price"\s*:\s*"([\d.]+)"',
            r'[€$]([\d,]+\.?\d{0,2})',
        ]:
            m = re.search(pat, html)
            if m:
                try:
                    price = float(m.group(1).replace(',', '.'))
                    if price > 10:
                        data['price'] = f'€{price:.2f}'
                        data['currency'] = 'EUR'
                        break
                except:
                    pass

    if 'description' not in data:
        for pat in [
            r'<div[^>]*class="[^"]*product-description[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*class="[^"]*product__description[^"]*"[^>]*>(.*?)</div>',
            r'<div[^>]*itemprop="description"[^>]*>(.*?)</div>',
        ]:
            m = re.search(pat, html, re.DOTALL | re.IGNORECASE)
            if m:
                desc = clean_html(m.group(1))
                if len(desc) > 20:
                    data['description'] = desc
                    break

    # Images
    if 'images' not in data:
        images = set()
        for m in re.finditer(r'(//cdn\.shopify\.com/s/files/1/0121/0932/products/[^\s"\'<>?]+\.(?:jpg|jpeg|png|webp))', html, re.IGNORECASE):
            img = 'https:' + re.sub(r'_\d+x\d*\.', '.', m.group(1))
            img = re.sub(r'\?.*$', '', img)
            if 'icon' not in img.lower() and 'logo' not in img.lower():
                images.add(img)
        if images:
            data['images'] = sorted(images)

    return data

def parse_product_page(html, model, url, timestamp):
    """Auto-detect era and parse."""
    year = int(timestamp[:4])

    if year <= 2015:
        return parse_old_shopify_page(html, model, url)
    else:
        return parse_new_shopify_page(html, model, url)

# ── Fetch objects from DB ────────────────────────────────────────────────────

def fetch_db_objects_batch(names):
    """Fetch objects from DB matching these names."""
    if not SUPABASE_KEY:
        return []

    all_rows = []
    for i in range(0, len(names), 30):
        batch = names[i:i+30]
        name_filter = ','.join(quote(n, safe='') for n in batch)
        path = f'objects?select=id,name,season,structured_data,acronym_style,acronym_category,source_site&name=in.({",".join(batch)})&limit=200'
        result = supabase_get(path)
        if result:
            all_rows.extend(result)
        time.sleep(0.3)
    return all_rows

def update_db_object(obj_id, structured_data, acronym_style, acronym_category):
    """Update a DB object with enriched data."""
    patch = {}
    if structured_data:
        patch['structured_data'] = structured_data
    if acronym_style and not patch.get('acronym_style'):
        patch['acronym_style'] = acronym_style
    if acronym_category and not patch.get('acronym_category'):
        patch['acronym_category'] = acronym_category

    return supabase_patch(f'objects?id=eq.{obj_id}', patch)

# ── All products to process ───────────────────────────────────────────────────

# Early-era products (FW03-FW11) - not in Wayback CDX
# Will get style/category metadata only
EARLY_ERA_PRODUCTS = [
    ('GT-J17', 'FW09'), ('E-J3S', 'FW07'), ('L-J1', 'FW05'), ('GT-J9TS', 'FW05'),
    ('SS-J7C', 'SS10'), ('SS-J3', 'SS07'), ('L-J2', 'FW09'), ('E-J2', 'FW06'),
    ('SS-J4', 'FW06'), ('GT-J10', 'FW06'), ('SS-J6W', 'FW05'), ('E-J1A', 'FW03'),
    ('GT-J5', 'FW04'), ('GT-J13', 'FW07'), ('GT-J6', 'FW04'), ('SS-J5', 'FW06'),
    ('PL-J2', 'FW09'), ('S-J8', 'FW10'), ('GT-J19', 'FW10'), ('SS-J16', 'FW09'),
    ('GT-J12', 'SS07'), ('X-J13', 'SS11'), ('SS-J12TS', 'FW09'), ('S-J7', 'SS10'),
    ('SS-J10', 'FW08'), ('SS-J1', 'FW03'), ('PL-J1', 'FW09'), ('SS-J8', 'SS09'),
    # Secondary market grailed early
    ('GT-J4', 'FW04'), ('GT-J8', 'FW05'), ('GT-J11', 'FW06'), ('GT-J15', 'FW08'),
    ('S-J4TS', 'FW08'),
]

# Products with Wayback pages to fetch
WAYBACK_PRODUCTS = [
    # GT-J18 has a close variant (GT-J18F = women's) - parse it
    ('GT-J18', 'FW11', 'http://www.acrnm.com:80/products/gt-j18f', '20131008000000'),
    # SS-JF1 has variant SS-JF1B
    ('SS-JF1', 'FW11', 'http://www.acrnm.com:80/products/ss-jf1b', '20130329000000'),
    # Era-2 products that ARE confirmed in CDX
    ('J64-TS', 'SS18', 'https://acrnm.com/products/J64TS-S_FW1718', '20170915000000'),
    ('J74-LP', 'FW19', 'https://acrnm.com/products/J74-PX_FW1819', '20181025000000'),
    ('J97-WS', 'FW21', 'https://acrnm.com/products/J97-M_SS22', '20220519000000'),
    # Era-2 products to TRY (may or may not be cached)
    ('J62-S',  'FW17', 'https://acrnm.com/products/J62-S_FW1718', '20171915000000'),
    ('J56-S',  'FW17', 'https://acrnm.com/products/J56-S_FW1718', '20171120000000'),
    ('SM1-AM', 'FW17', 'https://acrnm.com/products/SM1-AK_FW1819', '20181025000000'),
    ('P10A-CH','FW17', 'https://acrnm.com/products/P10A-DS_SS19', '20190529000000'),
    ('J1E',    'SS20', 'https://acrnm.com/products/J1L-GT_SS20', '20200407000000'),
    ('J60-WS', 'FW17', 'https://acrnm.com/products/J65-WS_FW1718', '20170915000000'),
    ('J99-GT', 'FW21', 'https://acrnm.com/products/J99-WS_FW2122', '20211130000000'),
    ('J52-A',  'SS16', 'https://acrnm.com/products/J44L-GT_SS16', '20161119000000'),
    ('J32-GT', 'FW13', 'https://acrnm.com/products/j36-gt', '20131018000000'),
    ('P40-DS', 'FW21', 'https://acrnm.com/products/P37-DS_FW2021', '20201026000000'),
    ('J28-K',  'SS16', 'https://acrnm.com/products/J43-K_SS15', '20160629000000'),
    ('J48-CH', 'FW20', 'https://acrnm.com/products/J48-SS_FW2021', '20200926000000'),
    ('J1TS-S', 'FW16', 'https://acrnm.com/products/J40-L_FW1516', '20160629000000'),
    ('J80-PX', 'SS19', 'https://acrnm.com/products/J29-PX_FW1920', '20190925000000'),
    ('J77-WS', 'FW19', 'https://acrnm.com/products/J78-WS_FW1920', '20191127000000'),
    ('J110-GT','FW23', 'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
    ('J120-GT','SS23', 'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
    ('J1TS-GT','FW16', 'https://acrnm.com/products/J1A-GT_NA', '20160628000000'),
    ('J107-GT','SS22', 'https://acrnm.com/products/J96-GT_SS22', '20220403000000'),
    ('J50-GT', 'FW16', 'https://acrnm.com/products/J50-S_FW1617', '20170129000000'),
    ('J2A-GT', 'FW11', 'http://www.acrnm.com:80/products/gt-j18f', '20131008000000'),
    ('J3HY',   'FW08', 'https://acrnm.com/products/J3-HY_FW2122', '20211202000000'),
    ('GT-J11', 'FW06', 'http://www.acrnm.com:80/products/gt-j22', '20120723000000'),
    ('GT-J4',  'FW04', 'http://www.acrnm.com:80/products/gt-j22', '20120723000000'),
    ('GT-J15', 'FW08', 'http://www.acrnm.com:80/products/gt-j22', '20120723000000'),
    ('GT-J8',  'FW05', 'http://www.acrnm.com:80/products/gt-j22', '20120723000000'),
    ('S-J4TS', 'FW08', 'http://www.acrnm.com:80/collections/_softshell/products/ds-j12ts', '20121013000000'),
]

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print('=== ACRONYM Wayback Enrichment v2 ===\n')

    # Load all target model names
    all_targets = [(m, s) for m, s in EARLY_ERA_PRODUCTS] + \
                  [(m, s) for m, s, url, ts in WAYBACK_PRODUCTS]

    # Deduplicate
    seen = set()
    unique_targets = []
    for m, s in all_targets:
        key = (m, s)
        if key not in seen:
            seen.add(key)
            unique_targets.append((m, s))

    print(f'Total unique targets: {len(unique_targets)}')

    # Fetch DB objects
    all_names = list(set(m for m, s in unique_targets))
    print(f'Fetching DB objects for {len(all_names)} model names...')

    if not SUPABASE_KEY:
        print('WARNING: No SUPABASE_SERVICE_KEY. Will skip DB writes.')
        db_objects = []
    else:
        db_objects = fetch_db_objects_batch(all_names)

    print(f'Found {len(db_objects)} DB rows')

    # Index by (name, season)
    db_index = {}
    for obj in db_objects:
        key = (obj['name'], obj.get('season', ''))
        if key not in db_index:
            db_index[key] = []
        db_index[key].append(obj)

    # Also index by name only (for approximate matches)
    db_by_name = {}
    for obj in db_objects:
        name = obj['name']
        if name not in db_by_name:
            db_by_name[name] = []
        db_by_name[name].append(obj)

    results = []
    updated_total = 0

    # ── Phase 1: Early-era products (style/category only) ──────────────────
    print(f'\n=== Phase 1: Early-era products (style/category metadata) ===')

    early_done = set()
    for model, season in EARLY_ERA_PRODUCTS:
        if (model, season) in early_done:
            continue
        early_done.add((model, season))

        acronym_style, acronym_category = infer_style_category(model)

        # Find DB matches
        target_objs = db_index.get((model, season), db_by_name.get(model, []))
        season_objs = [o for o in target_objs if o.get('season') == season]
        if season_objs:
            target_objs = season_objs

        print(f'  [{model} {season}]: style={acronym_style}, cat={acronym_category}, db={len(target_objs)} rows')

        structured = {
            'model': model,
            'season': season,
            'era': 'pre_shopify',
            'wayback_found': False,
            'enriched_from': 'style_inference',
        }

        result_entry = {
            'model': model, 'season': season, 'status': 'metadata_only',
            'acronym_style': acronym_style, 'acronym_category': acronym_category,
            'db_matches': len(target_objs), 'db_updated': [],
        }

        for obj in target_objs:
            if update_db_object(obj['id'], structured, acronym_style, acronym_category):
                print(f'    ✓ Updated {obj["id"]} ({obj["name"]} {obj.get("season", "")})')
                updated_total += 1
                result_entry['db_updated'].append(obj['id'])

        results.append(result_entry)

    # ── Phase 2: Products with Wayback pages ───────────────────────────────
    print(f'\n=== Phase 2: Fetching Wayback pages ===')

    wb_done = set()
    for model, season, wb_orig_url, wb_ts in WAYBACK_PRODUCTS:
        if (model, season) in wb_done:
            continue
        wb_done.add((model, season))

        print(f'\n[{model} {season}]')

        # Check cache
        cache_key = f'{model.lower().replace("-", "")}_{season.lower()}'
        html_cache = os.path.join(OUTPUT_DIR, f'v2_html_{cache_key}.html')
        json_cache = os.path.join(OUTPUT_DIR, f'v2_parsed_{cache_key}.json')

        parsed = None

        if os.path.exists(json_cache):
            with open(json_cache) as f:
                parsed = json.load(f)
            print(f'  Loaded from cache: {json_cache}')
        else:
            # Fetch from Wayback
            wb_url = f'{WB_BASE}/{wb_ts}id_/{wb_orig_url}'
            print(f'  Fetching: {wb_url}')
            html = fetch(wb_url)

            if html and len(html) > 2000:
                with open(html_cache, 'w') as f:
                    f.write(html)

                parsed = parse_product_page(html, model, wb_orig_url, wb_ts)
                parsed['model'] = model
                parsed['season'] = season
                parsed['wayback_found'] = True
                parsed['wayback_url'] = wb_orig_url
                parsed['wayback_timestamp'] = wb_ts
                parsed['scraped_at'] = '2026-04-12'
                parsed['enriched_from'] = 'wayback'

                with open(json_cache, 'w') as f:
                    json.dump(parsed, f, indent=2)

                print(f'  Parsed: name={parsed.get("name", "?")}, price={parsed.get("price", "?")}, images={len(parsed.get("images", []))}')
            else:
                print(f'  Failed to fetch or empty response')
                parsed = {
                    'model': model, 'season': season,
                    'wayback_found': False,
                    'wayback_url': wb_orig_url,
                    'enriched_from': 'wayback_failed',
                }

            time.sleep(DELAY)

        acronym_style, acronym_category = infer_style_category(model)

        # Find DB matches
        target_objs = db_index.get((model, season), db_by_name.get(model, []))
        season_objs = [o for o in target_objs if o.get('season') == season]
        if season_objs:
            target_objs = season_objs

        result_entry = {
            'model': model, 'season': season, 'status': 'wayback_parsed',
            'parsed': parsed, 'acronym_style': acronym_style,
            'acronym_category': acronym_category,
            'db_matches': len(target_objs), 'db_updated': [],
        }

        for obj in target_objs:
            if update_db_object(obj['id'], parsed, acronym_style, acronym_category):
                print(f'  ✓ Updated {obj["id"]} ({obj["name"]} {obj.get("season", "")})')
                updated_total += 1
                result_entry['db_updated'].append(obj['id'])

        if not target_objs:
            print(f'  No DB rows found for {model} {season}')

        results.append(result_entry)

    # ── Save results ───────────────────────────────────────────────────────
    output_file = os.path.join(OUTPUT_DIR, 'old_products_enrichment.json')
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total_targets': len(unique_targets),
                'phase1_metadata_only': len(EARLY_ERA_PRODUCTS),
                'phase2_wayback': len(WAYBACK_PRODUCTS),
                'db_rows_updated': updated_total,
                'run_at': '2026-04-12',
            },
            'results': results,
        }, f, indent=2)

    print(f'\n=== FINAL SUMMARY ===')
    print(f'Total DB rows updated: {updated_total}')
    print(f'Results saved to: {output_file}')

if __name__ == '__main__':
    main()
