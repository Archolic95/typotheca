/**
 * Insert missing ACRONYM products identified via Wayback Machine cross-validation.
 * Products:
 * 1. GT-J34-OLIVE (FW13) - Olive colorway of GT-J34
 * 2. J57TS-SS (FW16) - Inner shell variant
 * 3. P30A-DS (NA) - Original colorway/listing predating SS21
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- Step 1: Verify products are actually missing ---
async function verifyMissing() {
  console.log('\n=== Step 1: Verifying products are missing ===');

  const checks = [
    { label: 'GT-J34-OLIVE', filter: (o) => o.brand === 'acronym' && o.name?.toUpperCase().includes('GT-J34') && o.name?.toUpperCase().includes('OLIVE') },
    { label: 'J57TS-SS', filter: (o) => o.brand === 'acronym' && o.name?.toUpperCase().includes('J57TS') },
    { label: 'P30A-DS (NA / no season)', filter: (o) => o.brand === 'acronym' && o.model_code === 'P30A-DS' && !o.season },
  ];

  const { data: acronymObjects } = await sb
    .from('objects')
    .select('id,name,model_code,season,source_url')
    .eq('brand', 'acronym');

  for (const check of checks) {
    const found = acronymObjects.filter(check.filter);
    if (found.length > 0) {
      console.log(`  [FOUND] ${check.label} - already in DB:`, found.map(f => `${f.name} (${f.season})`).join(', '));
    } else {
      console.log(`  [MISSING] ${check.label} - NOT in DB, will insert`);
    }
  }

  return acronymObjects;
}

// --- Step 2: Load enrichment data ---
function loadEnrichment() {
  const oldEra = JSON.parse(readFileSync('/tmp/wayback-acrnm/old_era_enrichment.json', 'utf8'));
  const midP30aDs = JSON.parse(readFileSync('/tmp/wayback-acrnm/mid_P30A-DS_NA.json', 'utf8'));
  const p30aDsImages = JSON.parse(readFileSync('/tmp/wayback-acrnm/p30a-ds_na.json', 'utf8'));

  return { oldEra, midP30aDs, p30aDsImages };
}

// --- Step 3: Insert products ---
async function insertProducts() {
  const { oldEra, midP30aDs, p30aDsImages } = loadEnrichment();

  const gtJ34Olive = oldEra['gt-j34-olive'];
  console.log('\n=== Step 2: Enrichment data loaded ===');
  console.log('GT-J34-OLIVE desc:', gtJ34Olive?.description?.substring(0, 80) + '...');
  console.log('P30A-DS NA subtitle:', midP30aDs?.subtitle);

  const toInsert = [
    // 1. GT-J34-OLIVE (FW13)
    {
      brand: 'acronym',
      name: 'GT-J34 / Olive',
      model_code: 'GT-J34',
      season: 'FW13',
      source_site: 'acrnm.com',
      source_url: 'https://web.archive.org/web/20131111030518/http://www.acrnm.com/collections/hardshell/products/gt-j34-olive',
      category_1: 'Clothing',
      category_2: 'Jacket',
      acronym_category: 'Jacket',
      acronym_style: 'hardshell parka',
      colorway_count: 1,
      features: [],
      sizes_available: [],
      genre: [],
      specs: {},
      sections: {},
      retail_currency: 'EUR',
      in_stock: false,
      is_secondary_market: false,
      discontinued: true,
      limited_edition: false,
      notion_copped: false,
      personal_wear_count: 0,
      personal_images: [],
      structured_data: {
        type: gtJ34Olive?.type,
        style: gtJ34Olive?.style,
        generation: gtJ34Olive?.generation,
        description: gtJ34Olive?.description,
        fabric: gtJ34Olive?.fabric,
        weight: gtJ34Olive?.weight,
        includes: gtJ34Olive?.includes,
        systems: gtJ34Olive?.systems,
        pockets: gtJ34Olive?.pockets,
        ip: gtJ34Olive?.ip,
        slug: 'gt-j34-olive',
        wayback_ts: gtJ34Olive?.wayback_ts,
        colorway: 'olive',
      },
    },

    // 2. J57TS-SS (FW16) - inner shell variant, no Wayback product page data found
    {
      brand: 'acronym',
      name: 'J57TS-SS',
      model_code: 'J57TS-SS',
      season: 'FW16',
      source_site: 'acrnm.com',
      source_url: 'https://web.archive.org/web/2016/https://acrnm.com/products/J57TS-SS_FW1617',
      category_1: 'Clothing',
      category_2: 'Jacket',
      acronym_category: 'Jacket',
      acronym_style: 'inner shell jacket',
      colorway_count: 1,
      features: [],
      sizes_available: [],
      genre: [],
      specs: {},
      sections: {},
      retail_currency: 'EUR',
      in_stock: false,
      is_secondary_market: false,
      discontinued: true,
      limited_edition: false,
      notion_copped: false,
      personal_wear_count: 0,
      personal_images: [],
      structured_data: {
        slug: 'J57TS-SS_FW1617',
        wayback_ts: 'FW1617',
        notes: 'Inner shell variant of J57TS. Identified from FW16/17 Wayback homepage listing. No product page data recovered.',
        colorway: 'standard',
      },
    },

    // 3. P30A-DS (NA) - pre-SS21, original run listed without season
    {
      brand: 'acronym',
      name: 'P30A-DS',
      model_code: 'P30A-DS',
      season: null,
      source_site: 'acrnm.com',
      source_url: 'https://web.archive.org/web/20190627182236/https://acrnm.com/products/P30A-DS_NA',
      category_1: 'Clothing',
      category_2: 'Trousers',
      acronym_category: 'Pant',
      acronym_style: 'cargo trouser',
      colorway_count: 1,
      features: midP30aDs?.features || [],
      sizes_available: midP30aDs?.sizes || [],
      genre: [],
      specs: {},
      sections: {},
      retail_currency: 'EUR',
      in_stock: false,
      is_secondary_market: false,
      discontinued: true,
      limited_edition: false,
      notion_copped: false,
      personal_wear_count: 0,
      personal_images: [],
      // image_urls are Shopify CDN URLs from old wayback, not R2 — omit
      structured_data: {
        subtitle: midP30aDs?.subtitle,
        type: midP30aDs?.type,
        gen: midP30aDs?.gen,
        style: midP30aDs?.style,
        description: midP30aDs?.description,
        fabric: midP30aDs?.fabric,
        sizes: midP30aDs?.sizes,
        slug: 'P30A-DS_NA',
        wayback_ts: midP30aDs?.wayback_ts,
        sold_out: midP30aDs?.sold_out,
        era: 'old',
        notes: 'Original P30A-DS listing (NA season). Predates SS21 run. Distinct from P30A-DS_SS21 already in DB.',
      },
    },
  ];

  console.log('\n=== Step 3: Inserting products ===');

  const results = [];
  for (const product of toInsert) {
    const { data, error } = await sb.from('objects').insert(product).select('id,name,model_code,season');
    if (error) {
      console.error(`  [ERROR] ${product.name} (${product.season}):`, error.message);
      results.push({ name: product.name, success: false, error: error.message });
    } else {
      console.log(`  [OK] Inserted: ${product.name} (${product.season}) => id ${data[0]?.id}`);
      results.push({ name: product.name, success: true, id: data[0]?.id, season: product.season });
    }
  }

  return results;
}

// --- Step 4: Verify era3 coverage ---
async function checkEra3Coverage() {
  console.log('\n=== Step 4: Checking Era 3 enrichment vs DB ===');
  const era3 = JSON.parse(readFileSync('/tmp/wayback-acrnm/era3_enrichment.json', 'utf8'));
  const era3Keys = Object.keys(era3);

  const { data: allObjects } = await sb
    .from('objects')
    .select('name,model_code,season')
    .eq('brand', 'acronym');

  const missing = [];
  for (const key of era3Keys) {
    const [modelPart] = key.split('_');
    const found = allObjects.some(o => {
      const nameMatch = o.name && o.name.toUpperCase().includes(modelPart.toUpperCase());
      const mcMatch = o.model_code && o.model_code.toUpperCase() === modelPart.toUpperCase();
      return nameMatch || mcMatch;
    });
    if (!found) {
      missing.push(key);
    }
  }

  if (missing.length === 0) {
    console.log('  All 294 era3 products have at least one match in DB.');
  } else {
    console.log(`  ${missing.length} era3 products NOT in DB:`, missing);
  }
  return missing;
}

// --- Main ---
async function main() {
  const dbObjects = await verifyMissing();
  const insertResults = await insertProducts();
  const era3Missing = await checkEra3Coverage();

  console.log('\n=== Summary ===');
  console.log('Insert results:', insertResults);
  console.log('Era3 products missing from DB:', era3Missing.length === 0 ? 'None' : era3Missing);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
