#!/usr/bin/env python3
"""
Re-enrich products from the Rails-era acrnm.com (FW1617 - FW2223).
This era uses /content/images/ for product images and has rich structured HTML.
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
        print(f'  PATCH error {e.code}: {e.read().decode()[:200]}')
        return False

def clean_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    for e, r in [('&amp;', '&'), ('&nbsp;', ' '), ('&lt;', '<'), ('&gt;', '>'),
                  ('&euro;', '€'), ('&#8364;', '€'), ('&rsquo;', "'"), ('&mdash;', '—'),
                  ('&ldquo;', '"'), ('&rdquo;', '"'), ('ǽ', 'æ'), ('ǍCROŇYMř', 'ACRONYM®')]:
        text = text.replace(e, r)
    text = re.sub(r'&#\d+;', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def parse_rails_era(html, model, url):
    """Parse FW1617-FW2223 ACRONYM Rails app product page."""
    data = {'_parser': 'rails_era', '_source_url': url}

    # Product name from slug in URL or og:title
    m = re.search(r'/products/([A-Z0-9\-]+)_', url)
    if m:
        data['name'] = m.group(1)

    # Short description (the product subtitle)
    m = re.search(r'<div[^>]*class="[^"]*column[^"]*details[^"]*"[^>]*>.*?<p>\s*(.*?)\s*(?:<br|</p)', html, re.DOTALL | re.IGNORECASE)
    if m:
        subtitle = clean_html(m.group(1))
        if subtitle and len(subtitle) < 200:
            data['subtitle'] = subtitle

    # Full product details
    det_m = re.search(r'<div[^>]*class="product-details"[^>]*>(.*?)</div>\s*(?:<a[^>]*return-to-top|</div>)', html, re.DOTALL | re.IGNORECASE)
    if det_m:
        details_html = det_m.group(1)
        details_text = clean_html(details_html)
        if len(details_text) > 20:
            data['description'] = details_text

        # Extract structured sections
        sections = {}
        # Split on <h2> tags
        for m in re.finditer(r'<h2>([^<]+)</h2>\s*(.*?)(?=<h2>|$)', details_html, re.DOTALL | re.IGNORECASE):
            section_name = m.group(1).strip().lower().replace(' ', '_')
            section_content = clean_html(m.group(2))
            if section_content:
                sections[section_name] = section_content
        if sections:
            data['sections'] = sections

    # Type/Gen/Style from sub-description
    m = re.search(r'<span[^>]*class="sub-description[^"]*"[^>]*>(.*?)</span>', html, re.DOTALL | re.IGNORECASE)
    if m:
        sub = clean_html(m.group(1))
        data['product_type_info'] = sub

        # Extract Type
        type_m = re.search(r'Type\s*([A-Z]{1,3})', sub)
        if type_m:
            data['product_type'] = type_m.group(1)

        # Extract Generation
        gen_m = re.search(r'Gen\.\s*(\d+)', sub)
        if gen_m:
            data['generation'] = int(gen_m.group(1))

    # Price
    price_m = re.search(r'class="price"[^>]*>\s*([\d,€$]+(?:\.\d{2})?)', html, re.IGNORECASE)
    if not price_m:
        # "Coming soon" = no price
        if 'Coming soon' in html:
            data['price'] = 'Coming soon'
        else:
            for pat in [r'€\s*([\d,]+(?:\.\d{2})?)', r'(\d+)\s*EUR']:
                pm = re.search(pat, html)
                if pm:
                    try:
                        price_val = float(pm.group(1).replace(',', '.'))
                        if 50 < price_val < 15000:
                            data['price'] = f'€{price_val:.2f}'
                            data['currency'] = 'EUR'
                    except:
                        pass
    else:
        price_str = price_m.group(1).strip()
        if '€' in price_str:
            try:
                pv = float(price_str.replace('€', '').replace(',', '.').strip())
                if 50 < pv < 15000:
                    data['price'] = f'€{pv:.2f}'
                    data['currency'] = 'EUR'
            except:
                pass
        elif price_str.isdigit():
            data['price'] = f'€{int(price_str):.2f}'
            data['currency'] = 'EUR'

    # Weight
    m = re.search(r'Weight:\s*([\d,]+\.?\d*)\s*g', html, re.IGNORECASE)
    if m:
        try:
            data['weight_grams'] = int(float(m.group(1).replace(',', '.')))
        except:
            pass

    # Images from /content/images/
    images = []
    seen = set()
    for m in re.finditer(r'src="(/content/images/product/[^\s"]+\.(?:jpg|jpeg|png))"', html):
        img = 'https://acrnm.com' + m.group(1)
        # Remove duplicate size variants - keep w950 or just base
        img_key = re.sub(r'_w\d+\.', '.', img)
        if img_key not in seen:
            seen.add(img_key)
            images.append(img)
    if images:
        data['images'] = images

    return data

def infer_style_category(model):
    model_up = model.upper()
    prefix = model_up.split('-')[0]

    style_map = {
        'GT': 'Hardshell / Waterproof', 'SS': 'Softshell / Water Resistant',
        'E': 'NTS / Next to Skin', 'L': 'Lightshell', 'PL': 'Lightshell',
        'S': 'Softshell', 'DS': 'NTS', 'X': 'Special Projects', 'SM': 'NTS',
    }
    acronym_style = style_map.get(prefix)

    if re.match(r'^J\d+', model_up):
        suffix_m = re.search(r'-([A-Z]+)(?:_|$)', model_up)
        suffix = suffix_m.group(1) if suffix_m else ''
        suf_style_map = {
            'GT': 'Hardshell / Waterproof', 'WS': 'Windshell', 'LP': 'Lightshell',
            'PX': 'Softshell / Expandable', 'DS': 'NTS', 'S': 'Softshell',
            'SS': 'Softshell', 'E': 'NTS / Next to Skin', 'AM': 'NTS',
            'AK': 'Hardshell / Waterproof', 'HY': 'Hybrid', 'CH': 'Water Resistant',
            'A': 'Softshell', 'K': 'Knitwear', 'GTPL': 'Hardshell / Waterproof',
            'L': 'Lightshell',
        }
        acronym_style = suf_style_map.get(suffix, acronym_style)

    if re.match(r'^P\d+', model_up) or 'P10A' in model_up or 'P40' in model_up:
        acronym_category = 'Pant'
    elif 'SM' in model_up and not model_up.startswith('J'):
        acronym_category = 'Mask'
    elif 'J' in model_up:
        acronym_category = 'Jacket'
    elif model_up.startswith('S-'):
        acronym_category = 'Jacket'
    else:
        acronym_category = None

    return acronym_style, acronym_category

# Products to re-enrich with Rails-era parser
# These got "ACRONYM® GmbH..." as their name (failed parse)
# Format: (model, season, obj_id, wb_url, wb_ts)
RAILS_ERA_PRODUCTS = [
    # Products that need re-enrichment with rails parser
    ('J62-S',   'FW17', None,                                      'https://acrnm.com/products/J62-S_FW1718', '20171120000000'),
    ('SM1-AM',  'FW17', None,                                      'https://acrnm.com/products/SM1-AK_FW1819', '20181025000000'),
    ('P10A-CH', 'FW17', None,                                      'https://acrnm.com/products/P10A-DS_SS19', '20190529000000'),
    # secondary market that got bad parses
    ('J77-WS', 'FW19', 'afe6898c-2bf9-4711-8f5a-91f97546a69b',   'https://acrnm.com/products/J78-WS_FW1920', '20191127000000'),
    ('J80-PX', 'SS19', '7c61f3da-2d53-4299-a386-9931cf12d184',   'https://acrnm.com/products/J29-PX_FW1920', '20190925000000'),
    ('P40-DS', 'FW21', '33080e52-cec6-412f-9947-d562fa975489',   'https://acrnm.com/products/P37-DS_FW2021', '20201026000000'),
    ('J1E',    'SS20', 'fb30bd7a-7b10-40ad-ac7f-e59e0f337122',   'https://acrnm.com/products/J1L-GT_SS20', '20200407000000'),
    ('J48-CH', 'FW20', 'db3d6549-bd6c-4614-a87a-0633282228f9',   'https://acrnm.com/products/J48-SS_FW2021', '20200926000000'),
    ('J99-GT', 'FW21', 'c3199011-fb05-4f4d-83bb-6b1109b8ed8d',   'https://acrnm.com/products/J99-WS_FW2122', '20211130000000'),
    ('J107-GT','SS22', 'f01017a1-9a1f-4b1c-85b6-dbc940323e4b',   'https://acrnm.com/products/J96-GT_SS22', '20220403000000'),
    ('J120-GT','SS23', '195e9727-07ed-4749-b4d6-566326734857',   'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
    ('J110-GT','FW23', '22e548db-c76a-4d65-8725-09fb310f3f22',   'https://acrnm.com/products/J104-GTPL_SS22', '20220724000000'),
    # also re-parse ones with partial data
    ('J56-S',  'FW17', 'a28c5427-da26-4bc0-b174-13d232e58db7',   'https://acrnm.com/products/J65-WS_FW1718', '20170915000000'),
    ('J60-WS', 'FW17', 'cf2e5d9b-e0b4-4fd0-8df5-dd48662020ee',   'https://acrnm.com/products/J65-WS_FW1718', '20170915000000'),
    ('J50-GT', 'FW16', '77d7c719-cc1c-4145-80da-0d4bf44b99e6',   'https://acrnm.com/products/J50-S_FW1617', '20170129000000'),
    ('J1TS-S', 'FW16', '8a59eefd-9857-48d8-a228-d5112aefe0ae',   'https://acrnm.com/products/J40-L_FW1516', '20160629000000'),
    ('J1TS-GT','FW16', 'f0437667-3e92-44e6-8293-736ce723d027',   'https://acrnm.com/products/J1A-GT_NA', '20160628000000'),
    ('J52-A',  'SS16', '3bf55a47-b7e1-4393-967f-227bc9d96ad6',   'https://acrnm.com/products/J44L-GT_SS16', '20161119000000'),
    ('J28-K',  'SS16', '4536dd91-91bf-48ca-926c-c7662f79469e',   'https://acrnm.com/products/J43-K_SS15', '20160629000000'),
    # J3HY - the modern re-issue J3-HY
    ('J3HY',   'FW08', 'f311a98a-5a2b-48b6-a461-96f8101939dd',   'https://acrnm.com/products/J3-HY_FW2122', '20211202000000'),
    # J74-LP
    ('J74-LP', 'FW19', None,                                      'https://acrnm.com/products/J74-PX_FW1819', '20181025000000'),
    # J97-WS
    ('J97-WS', 'FW21', None,                                      'https://acrnm.com/products/J97-M_SS22', '20220519000000'),
    # J64-TS
    ('J64-TS', 'SS18', None,                                      'https://acrnm.com/products/J64TS-S_FW1718', '20170915000000'),
]

def find_obj_id(model, season, source_site=None):
    """Find DB object ID by model name and season."""
    path = f'objects?select=id,name,season&name=eq.{model}&season=eq.{season}'
    if source_site:
        path += f'&source_site=eq.{source_site}'
    path += '&limit=5'

    url = f'{SUPABASE_URL}/rest/v1/{path}'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        rows = json.loads(resp.read())
        return [r['id'] for r in rows]
    except Exception as e:
        print(f'  DB lookup error: {e}')
        return []

def main():
    print('=== ACRONYM Rails-Era Re-Enrichment ===\n')

    updated_count = 0
    results = []

    for model, season, obj_id_override, wb_url, wb_ts in RAILS_ERA_PRODUCTS:
        print(f'\n[{model} {season}]')

        cache_key = f'rails_{model.lower().replace("-", "")}_{season.lower()}'
        html_cache = os.path.join(OUTPUT_DIR, f'{cache_key}.html')
        json_cache = os.path.join(OUTPUT_DIR, f'{cache_key}.json')

        parsed = None

        # Load cached
        if os.path.exists(json_cache):
            with open(json_cache) as f:
                parsed = json.load(f)
            print(f'  Cached: name={parsed.get("name", "?")}')
        else:
            fetch_url = f'{WB_BASE}/{wb_ts}id_/{wb_url}'
            print(f'  Fetching: {fetch_url}')
            html = fetch(fetch_url)

            if html and len(html) > 2000:
                with open(html_cache, 'w') as f:
                    f.write(html)

                parsed = parse_rails_era(html, model, wb_url)
                parsed['model'] = model
                parsed['season'] = season
                parsed['wayback_found'] = True
                parsed['wayback_url'] = wb_url
                parsed['wayback_timestamp'] = wb_ts
                parsed['wayback_base_model'] = wb_url.split('/products/')[-1].split('?')[0]
                parsed['scraped_at'] = '2026-04-12'
                parsed['enriched_from'] = 'wayback'

                with open(json_cache, 'w') as f:
                    json.dump(parsed, f, indent=2)

                print(f'  Parsed: name={parsed.get("name", "?")}, subtitle={parsed.get("subtitle", "?")[:60]}, imgs={len(parsed.get("images", []))}')
            else:
                print(f'  Fetch failed')
                parsed = {
                    'model': model, 'season': season,
                    'wayback_found': False, 'wayback_url': wb_url,
                    'enriched_from': 'wayback_failed',
                }

            time.sleep(DELAY)

        acronym_style, acronym_category = infer_style_category(model)

        # Get target IDs
        if obj_id_override:
            target_ids = [obj_id_override]
        else:
            # Try acrnm.com first, then any source
            target_ids = find_obj_id(model, season, 'acrnm.com')
            if not target_ids:
                target_ids = find_obj_id(model, season)

        print(f'  Target IDs: {target_ids}')
        print(f'  Style: {acronym_style} | Category: {acronym_category}')

        for tid in target_ids:
            patch_data = {
                'structured_data': parsed,
                'acronym_style': acronym_style,
                'acronym_category': acronym_category,
            }
            if supabase_patch(tid, patch_data):
                print(f'  ✓ Updated {tid}')
                updated_count += 1
            else:
                print(f'  ✗ Failed {tid}')

        results.append({
            'model': model, 'season': season,
            'parsed_name': parsed.get('name', '') if parsed else '',
            'parsed_subtitle': parsed.get('subtitle', '') if parsed else '',
            'images_count': len(parsed.get('images', [])) if parsed else 0,
            'acronym_style': acronym_style,
            'acronym_category': acronym_category,
            'db_updated': target_ids,
        })

    # Update the enrichment JSON
    enrichment_file = os.path.join(OUTPUT_DIR, 'old_products_enrichment.json')
    existing = {}
    if os.path.exists(enrichment_file):
        with open(enrichment_file) as f:
            existing = json.load(f)

    existing.setdefault('rails_era_enrichment', {})
    existing['rails_era_enrichment'] = {
        'db_rows_updated': updated_count,
        'results': results,
        'run_at': '2026-04-12',
    }
    existing['summary']['db_rows_updated_total'] = (
        existing.get('summary', {}).get('db_rows_updated', 0) + updated_count
    )

    with open(enrichment_file, 'w') as f:
        json.dump(existing, f, indent=2)

    print(f'\n=== DONE ===')
    print(f'Rails-era DB rows updated: {updated_count}')
    print(f'Results appended to: {enrichment_file}')

if __name__ == '__main__':
    main()
