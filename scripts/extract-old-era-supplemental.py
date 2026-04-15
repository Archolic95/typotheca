#!/usr/bin/env python3
"""
Extract supplemental data from cached 2012-era ACRONYM HTML files:
  - price_eur: EUR price from the page
  - sizing: SIZES [CM] / SIZE [CM] table parsed into structured JSON
  - pockets_structured: pocket counts as {total, external, internal}
  - made_in: country/region of manufacture

Saves to /tmp/wayback-acrnm/old_era_supplemental.json
Then merges into Supabase DB structured_data field.
"""

import json, os, re, sys
from html.parser import HTMLParser
from html import unescape

# ── Config ──────────────────────────────────────────────────────────────
HTML_DIR = '/tmp/wayback-acrnm'
OUTPUT_FILE = os.path.join(HTML_DIR, 'old_era_supplemental.json')

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL', 'https://soowdirfqjwggvijdquz.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

# ── HTML cleaning ────────────────────────────────────────────────────────
def strip_tags(html_str):
    """Remove HTML tags and unescape entities."""
    text = re.sub(r'<[^>]+>', ' ', html_str)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def clean_num(s):
    """Convert string like '42', '19.5', '42&nbsp;' to float or int."""
    s = unescape(s).strip()
    s = re.sub(r'[^\d.]', '', s)
    if not s:
        return None
    try:
        f = float(s)
        return int(f) if f == int(f) else f
    except ValueError:
        return None

# ── Extraction functions ─────────────────────────────────────────────────

def extract_price_eur(content):
    """
    Extract EUR price. The page shows multiple prices (original + on-sale).
    We want the first EUR price occurrence (list price).
    Returns string like '404.00' or None.
    """
    # Match &euro;NNN.NN or €NNN.NN or &#8364;NNN.NN
    m = re.search(r'(?:&euro;|€|&#8364;)\s*([\d,]+(?:\.\d{1,2})?)', content)
    if m:
        price_str = m.group(1).replace(',', '')
        return price_str
    return None


def extract_sizing_table(content):
    """
    Parse SIZES [CM] or SIZE [CM] HTML table into structured JSON.
    Returns dict like:
      {"sizes": ["S","M","L","XL"], "measurements": {"1/2 WAIST": [42,44,46,48]}}
    or None if no table found.
    """
    # Find the table that contains SIZE[S] [CM]
    # Look for the header marker first
    size_header_pat = re.compile(r'SIZES?\s*\[CM\]', re.IGNORECASE)

    # Find the <table> containing SIZE[S] [CM]
    # Strategy: find all <table>...</table> blocks, pick the one with SIZE[S] [CM]
    table_pat = re.compile(r'<table[^>]*>(.*?)</table>', re.DOTALL | re.IGNORECASE)

    sizing_table_html = None
    for m in table_pat.finditer(content):
        table_html = m.group(0)
        if size_header_pat.search(table_html):
            sizing_table_html = table_html
            break

    if not sizing_table_html:
        return None

    # Extract all rows
    row_pat = re.compile(r'<tr[^>]*>(.*?)</tr>', re.DOTALL | re.IGNORECASE)
    cell_pat = re.compile(r'<t[dh][^>]*>(.*?)</t[dh]>', re.DOTALL | re.IGNORECASE)

    rows = []
    for row_m in row_pat.finditer(sizing_table_html):
        row_html = row_m.group(1)
        cells = [strip_tags(c.group(1)) for c in cell_pat.finditer(row_html)]
        # Filter out completely empty cells
        if any(c.strip() for c in cells):
            rows.append(cells)

    if len(rows) < 2:
        return None

    # First row: header — first cell is "SIZES [CM]" or "SIZE [CM]", rest are size names
    header_row = rows[0]
    if not size_header_pat.search(header_row[0]):
        return None

    size_names = [c.strip() for c in header_row[1:] if c.strip()]

    if not size_names:
        return None

    measurements = {}
    for row in rows[1:]:
        if len(row) < 2:
            continue
        measure_name = row[0].strip()
        if not measure_name:
            continue
        values = []
        for i, size in enumerate(size_names):
            if i + 1 < len(row):
                v = clean_num(row[i + 1])
                values.append(v)
            else:
                values.append(None)
        if any(v is not None for v in values):
            measurements[measure_name] = values

    if not measurements:
        return None

    return {
        "sizes": size_names,
        "measurements": measurements
    }


def extract_pockets_structured(content):
    """
    Parse POCKETS section like:
      Total: 7
      _External: 7
      _Internal: 0
    Returns {"total": 7, "external": 7, "internal": 0} or None.
    """
    # Find the POCKETS: block
    idx = content.find('POCKETS:')
    if idx < 0:
        idx = content.find('POCKETS:<')
    if idx < 0:
        return None

    pocket_section = content[idx:idx+600]

    # Strip HTML to get plain text
    pocket_text = strip_tags(pocket_section)

    result = {}

    # Total
    m = re.search(r'Total[:\s]+(\d+)', pocket_text, re.IGNORECASE)
    if m:
        result['total'] = int(m.group(1))

    # External (with or without underscore prefix)
    m = re.search(r'_?External[:\s]+(\d+)', pocket_text, re.IGNORECASE)
    if m:
        result['external'] = int(m.group(1))

    # Internal
    m = re.search(r'_?Internal[:\s]+(\d+)', pocket_text, re.IGNORECASE)
    if m:
        result['internal'] = int(m.group(1))

    if not result:
        return None

    return result


def extract_made_in(content):
    """
    Extract "Made in X" from product page.
    Returns the country/region string (e.g., "Europe", "Germany", "Switzerland") or None.

    Note: There can be multiple "Made in" mentions:
      - Product: "Made in Europe"
      - Fabric: "_Made in Switzerland"
    We want the PRODUCT made_in (the one NOT preceded by underscore or fabric context).
    """
    # Search in raw HTML (before stripping) since newlines are preserved there.
    # Fabric "Made in" is prefixed by underscore in the HTML source.
    html_matches = []
    for m in re.finditer(r'(_?)Made in ([A-Za-z][A-Za-z\s]{1,30}?)(?:<|&|\.|,|\n|\r)', content):
        underscore = m.group(1)
        country = m.group(2).strip()
        if country:
            html_matches.append((underscore, country))

    if not html_matches:
        return None

    # Prefer non-underscore (product-level) ones
    non_fabric = [c for (u, c) in html_matches if not u]
    if non_fabric:
        return non_fabric[0]

    # All are fabric-level — return the first anyway (better than nothing)
    return html_matches[0][1]


# ── Slug to name conversion ──────────────────────────────────────────────

def slug_to_name(fname):
    """Convert html_p9-ch.html → 'P9-CH'"""
    slug = fname.replace('html_', '').replace('.html', '')
    return slug.upper()


# ── DB operations via Supabase REST API ─────────────────────────────────

import urllib.request
import urllib.error

def supabase_request(method, path, body=None):
    """Make a Supabase REST API request."""
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }

    data = json.dumps(body).encode('utf-8') if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        print(f'  HTTP {e.code}: {err_body[:200]}')
        return None


def fetch_object_by_name(name):
    """Fetch object row by name (various matching strategies)."""
    import urllib.parse

    # Try exact
    rows = supabase_request('GET', f'objects?name=eq.{urllib.parse.quote(name)}&select=id,name,structured_data')
    if rows:
        return rows[0]

    # Try ilike
    rows = supabase_request('GET', f'objects?name=ilike.{urllib.parse.quote(name)}&select=id,name,structured_data')
    if rows:
        return rows[0]

    # Try prefix (name starts with slug)
    rows = supabase_request('GET', f'objects?name=ilike.{urllib.parse.quote(name + "%")}&select=id,name,structured_data')
    if rows:
        return rows[0]

    return None


def update_structured_data(obj_id, new_fields):
    """Merge new_fields into existing structured_data for the given object id."""
    import urllib.parse

    # First fetch current structured_data
    rows = supabase_request('GET', f'objects?id=eq.{obj_id}&select=id,structured_data')
    if not rows:
        return False

    existing = rows[0].get('structured_data') or {}
    updated = {**existing, **new_fields}

    result = supabase_request('PATCH', f'objects?id=eq.{obj_id}', {'structured_data': updated})
    return result is not None


# ── Main ─────────────────────────────────────────────────────────────────

def main():
    import urllib.parse

    html_files = sorted([
        f for f in os.listdir(HTML_DIR)
        if f.startswith('html_') and f.endswith('.html')
    ])

    print(f'Processing {len(html_files)} HTML files...\n')

    results = {}

    price_count = 0
    sizing_count = 0
    pockets_count = 0
    made_in_count = 0

    for fname in html_files:
        fpath = os.path.join(HTML_DIR, fname)
        content = open(fpath, encoding='utf-8', errors='ignore').read()

        name = slug_to_name(fname)

        extracted = {}

        # 1. Price EUR
        price = extract_price_eur(content)
        if price:
            extracted['price_eur'] = price
            price_count += 1

        # 2. Sizing table
        sizing = extract_sizing_table(content)
        if sizing:
            extracted['sizing'] = sizing
            sizing_count += 1

        # 3. Pockets structured
        pockets = extract_pockets_structured(content)
        if pockets:
            extracted['pockets_structured'] = pockets
            pockets_count += 1

        # 4. Made in
        made_in = extract_made_in(content)
        if made_in:
            extracted['made_in'] = made_in
            made_in_count += 1

        results[name] = extracted

        # Quick status line
        flags = []
        if price: flags.append(f'€{price}')
        if sizing: flags.append(f'sizing({len(sizing["measurements"])} rows)')
        if pockets: flags.append(f'pockets({pockets})')
        if made_in: flags.append(f'made_in={made_in}')
        print(f'  {name}: {" | ".join(flags) if flags else "(none)"}')

    print(f'\n── Extraction summary ──────────────────────────')
    print(f'  Files processed:   {len(html_files)}')
    print(f'  Prices found:      {price_count}')
    print(f'  Sizing tables:     {sizing_count}')
    print(f'  Pockets parsed:    {pockets_count}')
    print(f'  Made-in found:     {made_in_count}')

    # Save supplemental JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(results, f, indent=2)
    print(f'\nSaved to {OUTPUT_FILE}')

    # ── DB write ────────────────────────────────────────────────────────
    if not SUPABASE_KEY:
        print('\nNo SUPABASE_SERVICE_KEY found — skipping DB write.')
        return

    print(f'\n── Writing to Supabase DB ──────────────────────')

    written = 0
    not_found = 0
    skipped_empty = 0

    for name, extracted in results.items():
        if not extracted:
            skipped_empty += 1
            continue

        # Find the DB row
        row = fetch_object_by_name(name)
        if not row:
            print(f'  NOT FOUND: {name}')
            not_found += 1
            continue

        obj_id = row['id']
        existing_sd = row.get('structured_data') or {}

        # Merge: only add NEW fields, don't overwrite existing ones
        new_fields = {}
        for k, v in extracted.items():
            if k not in existing_sd or existing_sd[k] is None:
                new_fields[k] = v

        if not new_fields:
            print(f'  SKIP {name}: all fields already present')
            skipped_empty += 1
            continue

        # Update
        merged = {**existing_sd, **new_fields}
        result = supabase_request('PATCH', f'objects?id=eq.{obj_id}', {'structured_data': merged})

        if result is not None:
            written += 1
            field_names = list(new_fields.keys())
            print(f'  UPDATED {name} (id={obj_id}): added {field_names}')
        else:
            print(f'  FAILED {name} (id={obj_id})')

    print(f'\n── DB write summary ────────────────────────────')
    print(f'  Written:     {written}')
    print(f'  Not found:   {not_found}')
    print(f'  Skipped:     {skipped_empty}')
    print(f'  Total:       {len(results)}')


if __name__ == '__main__':
    main()
