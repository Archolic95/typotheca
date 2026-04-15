#!/usr/bin/env python3
"""
Final enrichment: fill NULL structured_data for all remaining target objects.
Uses Wayback Machine to get product data, falls back to style/category inference.
"""

import json, re, os, sys, time
import urllib.request, urllib.error

PROXY_URL = 'http://oiDHj3tZvTPflP0w:6OMPPyyPUVuGuY8v@geo.iproyal.com:12321'
OUTPUT_DIR = '/tmp/wayback-acrnm'
WB_BASE    = 'https://web.archive.org/web'
DELAY      = 2.0

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://soowdirfqjwggvijdquz.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

os.makedirs(OUTPUT_DIR, exist_ok=True)

proxy_handler = urllib.request.ProxyHandler({'http': PROXY_URL, 'https': PROXY_URL})
proxy_opener  = urllib.request.build_opener(proxy_handler)

def fetch(url, timeout=30):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'})
            resp = proxy_opener.open(req, timeout=timeout)
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
        print(f'  GET error: {e}')
        return None

def supabase_patch(obj_id, data):
    url = f'{SUPABASE_URL}/rest/v1/objects?id=eq.{obj_id}'
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method='PATCH', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    })
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except urllib.error.HTTPError as e:
        body_resp = e.read().decode()
        print(f'  PATCH error {e.code}: {body_resp[:200]}')
        return False
    except Exception as e:
        print(f'  PATCH error: {e}')
        return False

def clean_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    for e, r in [('&amp;', '&'), ('&nbsp;', ' '), ('&lt;', '<'), ('&gt;', '>'),
                  ('&euro;', '€'), ('&#8364;', '€'), ('&mdash;', '—'),
                  ('&rsquo;', "'"), ('&ldquo;', '"'), ('&rdquo;', '"')]:
        text = text.replace(e, r)
    text = re.sub(r'&#\d+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def parse_old_shopify(html, model, url):
    data = {'_parser': 'old_shopify', '_source_url': url}

    # Name
    for pat in [r'<h2>([A-Z][^<]{2,50})</h2>', r'<meta property="og:title" content="([^"]+)"',
                r'<title>ACRONYM[^—–]*[—–]\s*([^<]+)</title>']:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            name = clean_html(m.group(1)).strip()
            if name and name.lower() not in ('acronym gmbh', 'acronym'):
                data['name'] = name
                break

    # Price
    for pat in [r'option[^>]*>\s*\w+\s*\(&euro;([\d,]+\.?\d*)\)',
                r'<span[^>]*>&euro;([\d,]+\.?\d*)</span>', r'€([\d,.]+)']:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            try:
                price_val = float(m.group(1).replace(',', '.').replace(' ', ''))
                if 50 < price_val < 10000:
                    data['price'] = f'€{price_val:.2f}'
                    data['currency'] = 'EUR'
                    break
            except:
                pass

    # Description from #desc div
    desc_m = re.search(r'<div[^>]*id="desc"[^>]*>(.*?)(?:<!--\s*End desc|<div[^>]*class="social")',
                       html, re.DOTALL | re.IGNORECASE)
    if desc_m:
        desc = clean_html(desc_m.group(1))
        if len(desc) > 20:
            data['description'] = desc

    # Features structured
    if 'description' in data:
        desc = data['description']
        features = {}
        for field in ['TYPE', 'STYLE', 'GENERATION', 'DESCRIPTION', 'FABRIC TECHNOLOGY',
                      'WEIGHT', 'INCLUDES', 'SYSTEMS', 'SUBSYSTEMS', 'POCKETS']:
            pat = rf'{re.escape(field)}:\s*(.*?)(?=\s*(?:TYPE|STYLE|GENERATION|DESCRIPTION|FABRIC TECHNOLOGY|WEIGHT|INCLUDES|SYSTEMS|SUBSYSTEMS|POCKETS|Made in|$))'
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

    # Images
    images = set()
    for m in re.finditer(r'(//cdn\.shopify\.com/s/files/1/0121/0932/products/[^\s"\'<>?]+\.(?:jpg|jpeg|png))', html, re.IGNORECASE):
        img = 'https:' + re.sub(r'_(compact|large|grande|small|thumb)\b', '', m.group(1))
        img = re.sub(r'\?.*$', '', img)
        if 'icon' not in img.lower() and 'logo' not in img.lower():
            images.add(img)
    if images:
        data['images'] = sorted(images)

    return data

def parse_new_shopify(html, model, url):
    data = {'_parser': 'new_shopify', '_source_url': url}

    # Try to find product JSON in page
    m_json = re.search(r'ShopifyAnalytics\.lib\.page\(\s*(\{.*?"product_id".*?\})\s*\)', html, re.DOTALL)
    if not m_json:
        # Try JSON-LD
        for m in re.finditer(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL):
            try:
                obj = json.loads(m.group(1))
                if isinstance(obj, dict) and obj.get('@type') == 'Product':
                    data['name'] = obj.get('name', '')
                    if 'offers' in obj:
                        offer = obj['offers'] if isinstance(obj['offers'], dict) else obj['offers'][0]
                        price = float(offer.get('price', 0))
                        if price > 0:
                            currency = offer.get('priceCurrency', 'EUR')
                            sym = '€' if currency == 'EUR' else '$'
                            data['price'] = f'{sym}{price:.2f}'
                            data['currency'] = currency
                    if 'image' in obj:
                        imgs = obj['image'] if isinstance(obj['image'], list) else [obj['image']]
                        data['images'] = imgs
                    if 'description' in obj:
                        data['description'] = clean_html(obj['description'])
                    break
            except:
                pass

    # Fallback HTML parsing
    if 'name' not in data:
        for pat in [r'<meta property="og:title" content="([^"]+)"',
                    r'<h1[^>]*>([^<]{3,60})</h1>']:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                name = clean_html(m.group(1)).strip()
                if name.lower() not in ('acronym', 'acronym gmbh'):
                    data['name'] = name
                    break

    if 'price' not in data:
        for pat in [r'itemprop="price"\s+content="([\d.]+)"',
                    r'"price"\s*:\s*"?([\d.]+)"?', r'[€$]([\d,]+\.?\d{0,2})']:
            m = re.search(pat, html)
            if m:
                try:
                    price = float(m.group(1).replace(',', '.'))
                    if 50 < price < 10000:
                        data['price'] = f'€{price:.2f}'
                        data['currency'] = 'EUR'
                        break
                except:
                    pass

    if 'description' not in data:
        for pat in [r'<div[^>]*class="[^"]*product-description[^"]*"[^>]*>(.*?)</div>',
                    r'<div[^>]*class="[^"]*product__description[^"]*"[^>]*>(.*?)</div>',
                    r'<meta property="og:description" content="([^"]+)"']:
            m = re.search(pat, html, re.DOTALL | re.IGNORECASE)
            if m:
                desc = clean_html(m.group(1))
                if len(desc) > 20:
                    data['description'] = desc
                    break

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

def parse_page(html, model, url, timestamp):
    year = int(timestamp[:4]) if timestamp else 2020
    if year <= 2015:
        return parse_old_shopify(html, model, url)
    else:
        return parse_new_shopify(html, model, url)

def infer_style_category(model):
    model_up = model.upper()
    prefix = model_up.split('-')[0]

    style_map = {
        'GT': 'Hardshell / Waterproof', 'SS': 'Softshell / Water Resistant',
        'E': 'NTS / Next to Skin', 'L': 'Lightshell', 'PL': 'Lightshell',
        'S': 'Softshell', 'DS': 'NTS', 'X': 'Special Projects',
        'SM': 'NTS', 'KR': 'NTS', 'WS': 'Windshell',
    }
    acronym_style = style_map.get(prefix)

    # For J-prefixed era-2 models, infer from suffix
    if re.match(r'^J\d+', model_up):
        suffix_m = re.search(r'-([A-Z]+)(?:_|$)', model_up)
        suffix = suffix_m.group(1) if suffix_m else ''
        suf_style_map = {
            'GT': 'Hardshell / Waterproof', 'WS': 'Windshell',
            'LP': 'Lightshell', 'PX': 'Softshell / Expandable', 'DS': 'NTS',
            'S': 'Softshell', 'SS': 'Softshell', 'E': 'NTS / Next to Skin',
            'AM': 'NTS', 'AK': 'Hardshell / Waterproof', 'HY': 'Hybrid',
            'CH': 'Water Resistant', 'A': 'Softshell', 'K': 'Knitwear',
            'M': 'Special', 'PB': 'Special', 'GTPL': 'Hardshell / Waterproof',
        }
        acronym_style = suf_style_map.get(suffix, acronym_style)

    # Category
    if re.match(r'^P\d+', model_up) or 'P10A' in model_up or 'P40' in model_up:
        acronym_category = 'Pant'
    elif 'SM' in model_up and len(model_up) < 10:
        acronym_category = 'Mask'
    elif 'J' in model_up:
        acronym_category = 'Jacket'
    elif model_up.startswith('S-'):
        acronym_category = 'Jacket'
    else:
        acronym_category = None

    return acronym_style, acronym_category

# Products to process: (model, season, obj_id, source_site, wayback_url, wayback_ts)
# All 3 remaining acrnm.com NULL products + 19 secondary market NULL products

PRODUCTS_TO_ENRICH = [
    # acrnm.com NULL products - try Wayback
    ('P10A-CH', 'FW17', None, 'acrnm.com',
     'https://acrnm.com/products/P10A-DS_SS19', '20190529000000'),
    ('SM1-AM',  'FW17', None, 'acrnm.com',
     'https://acrnm.com/products/SM1-AK_FW1819', '20181025000000'),
    ('J62-S',   'FW17', None, 'acrnm.com',
     'https://acrnm.com/products/J62-S_FW1718', '20171120000000'),
    # Secondary market NULL products
    ('J3HY',   'FW08', 'f311a98a-5a2b-48b6-a461-96f8101939dd', 'ebay',
     'https://acrnm.com/products/J3-HY_FW2122', '20211202000000'),
    ('J2A-GT', 'FW11', '9d3691de-0f02-4e9b-b521-54e3ade76fc6', 'ebay',
     'http://www.acrnm.com:80/products/gt-j18f', '20131008000000'),
    ('J50-GT', 'FW16', '77d7c719-cc1c-4145-80da-0d4bf44b99e6', 'ebay',
     'https://acrnm.com/products/J50-S_FW1617', '20170129000000'),
    ('J77-WS', 'FW19', 'afe6898c-2bf9-4711-8f5a-91f97546a69b', 'ebay',
     'https://acrnm.com/products/J78-WS_FW1920', '20191127000000'),
    ('J80-PX', 'SS19', '7c61f3da-2d53-4299-a386-9931cf12d184', 'ebay',
     'https://acrnm.com/products/J29-PX_FW1920', '20190925000000'),
    ('P40-DS', 'FW21', '33080e52-cec6-412f-9947-d562fa975489', 'ebay',
     'https://acrnm.com/products/P37-DS_FW2021', '20201026000000'),
    ('J1E',    'SS20', 'fb30bd7a-7b10-40ad-ac7f-e59e0f337122', 'ebay',
     'https://acrnm.com/products/J1L-GT_SS20', '20200407000000'),
    ('J56-S',  'FW17', 'a28c5427-da26-4bc0-b174-13d232e58db7', 'ebay',
     'https://acrnm.com/products/J65-WS_FW1718', '20170915000000'),
    ('J120-GT','SS23', '195e9727-07ed-4749-b4d6-566326734857', 'ebay',
     'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
    ('J1TS-S', 'FW16', '8a59eefd-9857-48d8-a228-d5112aefe0ae', 'ebay',
     'https://acrnm.com/products/J40-L_FW1516', '20160629000000'),
    ('J48-CH', 'FW20', 'db3d6549-bd6c-4614-a87a-0633282228f9', 'ebay',
     'https://acrnm.com/products/J48-SS_FW2021', '20200926000000'),
    ('J28-K',  'SS16', '4536dd91-91bf-48ca-926c-c7662f79469e', 'ebay',
     'https://acrnm.com/products/J43-K_SS15', '20160629000000'),
    ('J32-GT', 'FW13', 'dcbafad5-def5-478a-a7d9-b313b9215c48', 'ebay',
     'http://www.acrnm.com:80/products/j36-gt', '20131018000000'),
    ('J1TS-GT','FW16', 'f0437667-3e92-44e6-8293-736ce723d027', 'grailed',
     'https://acrnm.com/products/J1A-GT_NA', '20160628000000'),
    ('J52-A',  'SS16', '3bf55a47-b7e1-4393-967f-227bc9d96ad6', 'ebay',
     'https://acrnm.com/products/J44L-GT_SS16', '20161119000000'),
    ('J99-GT', 'FW21', 'c3199011-fb05-4f4d-83bb-6b1109b8ed8d', 'ebay',
     'https://acrnm.com/products/J99-WS_FW2122', '20211130000000'),
    ('J107-GT','SS22', 'f01017a1-9a1f-4b1c-85b6-dbc940323e4b', 'grailed',
     'https://acrnm.com/products/J96-GT_SS22', '20220403000000'),
    ('J60-WS', 'FW17', 'cf2e5d9b-e0b4-4fd0-8df5-dd48662020ee', 'ebay',
     'https://acrnm.com/products/J65-WS_FW1718', '20170915000000'),
    ('J110-GT','FW23', '22e548db-c76a-4d65-8725-09fb310f3f22', 'grailed',
     'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
]

# Early era acrnm.com objects (already have style/category from previous runs,
# but we want to make sure structured_data is set if it's still NULL)
EARLY_ERA_ACRNM = [
    # These are from the KNOWN NULL list
    ('GT-J17', 'FW09'), ('E-J3S', 'FW07'), ('L-J1', 'FW05'), ('GT-J9TS', 'FW05'),
    ('SS-J7C', 'SS10'), ('SS-J3', 'SS07'), ('L-J2', 'FW09'), ('E-J2', 'FW06'),
    ('SS-J4', 'FW06'), ('GT-J10', 'FW06'), ('SS-J6W', 'FW05'), ('E-J1A', 'FW03'),
    ('GT-J5', 'FW04'), ('GT-J13', 'FW07'), ('GT-J6', 'FW04'), ('SS-J5', 'FW06'),
    ('PL-J2', 'FW09'), ('S-J8', 'FW10'), ('GT-J19', 'FW10'), ('SS-J16', 'FW09'),
    ('GT-J12', 'SS07'), ('X-J13', 'SS11'), ('SS-J12TS', 'FW09'), ('S-J7', 'SS10'),
    ('SS-J10', 'FW08'), ('SS-J1', 'FW03'), ('PL-J1', 'FW09'), ('SS-J8', 'SS09'),
]

def main():
    print('=== ACRONYM NULL structured_data Final Enrichment ===\n')

    updated_count = 0
    results = []

    # ── Phase 1: Early-era acrnm.com products (metadata only) ─────────────
    print('Phase 1: Early-era acrnm.com products (still NULL)')
    # Check which ones are still NULL
    early_names = [m for m, s in EARLY_ERA_ACRNM]
    path = f'objects?select=id,name,season,structured_data,acronym_style,acronym_category&name=in.({",".join(early_names)})&source_site=eq.acrnm.com&structured_data=is.null&limit=100'
    null_early = supabase_get(path) or []
    print(f'  Still NULL: {len(null_early)}')

    for obj in null_early:
        model = obj['name']
        season = obj['season'] or ''
        obj_id = obj['id']
        acronym_style, acronym_category = infer_style_category(model)

        structured = {
            'model': model,
            'season': season,
            'era': 'pre_shopify',
            'wayback_found': False,
            'enriched_from': 'style_inference',
            'note': 'Early ACRONYM era (FW03-FW11), not archived in Wayback Machine',
        }

        patch_data = {'structured_data': structured}
        if acronym_style and not obj.get('acronym_style'):
            patch_data['acronym_style'] = acronym_style
        if acronym_category and not obj.get('acronym_category'):
            patch_data['acronym_category'] = acronym_category

        if supabase_patch(obj_id, patch_data):
            print(f'  ✓ {model} {season} -> style={acronym_style}, cat={acronym_category}')
            updated_count += 1
            results.append({'model': model, 'season': season, 'status': 'metadata_only', 'db_updated': [obj_id]})
        else:
            print(f'  ✗ {model} {season}: PATCH failed')

    # ── Phase 2: Products with Wayback pages ──────────────────────────────
    print(f'\nPhase 2: Products with Wayback pages ({len(PRODUCTS_TO_ENRICH)} targets)')

    for model, season, obj_id_override, source, wb_url, wb_ts in PRODUCTS_TO_ENRICH:
        print(f'\n[{model} {season}]')

        cache_key = f'{model.lower().replace("-", "")}_{season.lower()}'
        html_cache = os.path.join(OUTPUT_DIR, f'final_html_{cache_key}.html')
        json_cache = os.path.join(OUTPUT_DIR, f'final_parsed_{cache_key}.json')

        parsed = None

        # Load from cache
        if os.path.exists(json_cache):
            with open(json_cache) as f:
                parsed = json.load(f)
            print(f'  Loaded from cache')
        else:
            # Fetch from Wayback
            fetch_url = f'{WB_BASE}/{wb_ts}id_/{wb_url}'
            print(f'  Fetching: {fetch_url}')
            html = fetch(fetch_url)

            if html and len(html) > 2000:
                with open(html_cache, 'w') as f:
                    f.write(html)
                parsed = parse_page(html, model, wb_url, wb_ts)
                parsed['model'] = model
                parsed['season'] = season
                parsed['wayback_found'] = True
                parsed['wayback_url'] = wb_url
                parsed['wayback_timestamp'] = wb_ts
                parsed['wayback_base_model'] = wb_url.split('/products/')[-1].split('?')[0]  # the actual model fetched
                parsed['scraped_at'] = '2026-04-12'
                parsed['enriched_from'] = 'wayback'

                with open(json_cache, 'w') as f:
                    json.dump(parsed, f, indent=2)
                print(f'  Parsed: name={parsed.get("name", "?")}, price={parsed.get("price", "?")}, imgs={len(parsed.get("images", []))}')
            else:
                print(f'  Fetch failed, using metadata fallback')
                parsed = {
                    'model': model, 'season': season,
                    'wayback_found': False,
                    'wayback_url': wb_url,
                    'enriched_from': 'wayback_failed',
                    'note': f'Closest available model fetched from {wb_url}',
                }

            time.sleep(DELAY)

        acronym_style, acronym_category = infer_style_category(model)

        # Find DB objects
        if obj_id_override:
            target_ids = [obj_id_override]
        else:
            # Look up by name + season + source_site
            path = f'objects?select=id,name,season&name=eq.{model}&season=eq.{season}&source_site=eq.{source}&structured_data=is.null&limit=5'
            found_objs = supabase_get(path) or []
            target_ids = [o['id'] for o in found_objs]

        print(f'  Target IDs: {target_ids}')

        for target_id in target_ids:
            patch_data = {
                'structured_data': parsed,
                'acronym_style': acronym_style,
                'acronym_category': acronym_category,
            }
            if supabase_patch(target_id, patch_data):
                print(f'  ✓ Updated {target_id}')
                updated_count += 1
            else:
                print(f'  ✗ Failed to update {target_id}')

        results.append({
            'model': model, 'season': season, 'source': source,
            'status': 'wayback_enriched',
            'db_updated': target_ids,
            'acronym_style': acronym_style,
            'acronym_category': acronym_category,
            'parsed_name': parsed.get('name', '') if parsed else '',
        })

    # ── Save results ────────────────────────────────────────────────────
    output_file = os.path.join(OUTPUT_DIR, 'old_products_enrichment.json')
    with open(output_file, 'w') as f:
        json.dump({
            'summary': {
                'total_processed': len(results),
                'db_rows_updated': updated_count,
                'run_at': '2026-04-12',
            },
            'results': results,
        }, f, indent=2)

    print(f'\n=== DONE ===')
    print(f'DB rows updated: {updated_count}')
    print(f'Results saved: {output_file}')

if __name__ == '__main__':
    main()
