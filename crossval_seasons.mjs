/**
 * ACRONYM Season Cross-Validation Script
 * Compares product seasons from Wayback Machine collection listings
 * against the Supabase database.
 *
 * Run from /Users/runjiatian/Desktop/typotheca/ to access node_modules
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://soowdirfqjwggvijdquz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvb3dkaXJmcWp3Z2d2aWpkcXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUwNzI2MCwiZXhwIjoyMDg5MDgzMjYwfQ.4pqKaT_8gkKStYBEjlo0uWvjS4BNNdlCOv2GWVZATNw';
const PROXY = 'http://oiDHj3tZvTPflP0w:6OMPPyyPUVuGuY8v@geo.iproyal.com:12321';
const LISTING_DIR = '/tmp/wayback-acrnm';
const OUTPUT_FILE = '/tmp/wayback-acrnm/season_crossval.json';

// Collection → Season mapping
const COLLECTION_SEASON_MAP = {
  '_ss13': 'SS13',
  '_new-fw1314': 'FW13',
  '_fw1415': 'FW14',
  '_new-ss14': 'SS14',
  '_new-ss15': 'SS15',
  '_new_fw-1213': 'FW12',
  '_softshell-ss12': 'SS12',
  '_softshell-ss12-1': 'SS12',
};

// Map Wayback slug → canonical model code for lookup
// Some slugs use old material-first naming (pre-FW13/14 era)
// These need to be matched to DB entries which preserve the original naming
// We just normalize to uppercase for comparison
function slugToModelCode(slug) {
  return slug.toUpperCase();
}

// ─── HTML Parsing ────────────────────────────────────────────────────────────

function extractProductSlugs(html) {
  const slugs = new Set();
  const re = /href=["'][^"']*\/products\/([^/"'?\s#]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].trim();
    if (slug && !slug.includes('{') && !slug.includes('%') && slug.length > 1) {
      slugs.add(slug);
    }
  }
  return [...slugs];
}

// ─── Wayback fetcher ─────────────────────────────────────────────────────────

function fetchViaProxy(url) {
  try {
    console.log(`  Fetching: ${url}`);
    const result = execSync(
      `curl -s --proxy "${PROXY}" --max-time 30 -L "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    return result.toString();
  } catch (e) {
    console.error(`  Failed to fetch ${url}: ${e.message.substring(0, 100)}`);
    return null;
  }
}

// ─── Load local listing files ─────────────────────────────────────────────────

function loadLocalListings() {
  const seasonSlugs = {}; // season → Set of slugs
  const files = readdirSync(LISTING_DIR).filter(f => f.startsWith('listing_') && f.endsWith('.html'));

  console.log(`Found ${files.length} local listing HTML files`);

  for (const file of files) {
    const path = `${LISTING_DIR}/${file}`;
    const html = readFileSync(path, 'utf-8');
    const slugs = extractProductSlugs(html);

    // Determine season from filename
    for (const [collKey, season] of Object.entries(COLLECTION_SEASON_MAP)) {
      const fileKey = collKey.replace(/^_/, '');
      if (file.includes(fileKey)) {
        if (!seasonSlugs[season]) seasonSlugs[season] = new Set();
        slugs.forEach(s => seasonSlugs[season].add(s));
        break;
      }
    }
  }

  // Gather all slugs from acronym-all and all-products listings
  const allSlugs = new Set();
  for (const file of files) {
    if (file.includes('acronym-all') || file.includes('all-products')) {
      const html = readFileSync(`${LISTING_DIR}/${file}`, 'utf-8');
      extractProductSlugs(html).forEach(s => allSlugs.add(s));
    }
  }

  return { seasonSlugs, allSlugs };
}

// ─── Parse season suffix from Era 2 product slugs ────────────────────────────
// Slugs like "J46-FO_FW1819" → { modelCode: "J46-FO", season: "FW18" }
// "S10-C_SS15" → { modelCode: "S10-C", season: "SS15" }

function parseEra2Slug(slug) {
  // Match trailing _SSYY or _FWYYYY or _FWYYYY (2-digit or 4-digit year)
  const m = /^(.+)_((?:SS|FW|NA)\d{2,4})$/i.exec(slug);
  if (m) {
    let [, modelCode, seasonRaw] = m;
    // Normalize season: FW1819 → FW18, SS18 → SS18, NA → NA
    let season = seasonRaw.toUpperCase();
    if (/^(FW|SS)\d{4}$/.test(season)) {
      season = season.slice(0, 4); // FW1819 → FW18
    }
    return { modelCode: modelCode.toUpperCase(), season };
  }
  return { modelCode: slug.toUpperCase(), season: null };
}

// ─── Fetch homepage snapshots ──────────────────────────────────────────────────

// Returns Map<slug, parsedInfo> where parsedInfo has modelCode and possibly season
function fetchHomepageProducts() {
  const years = ['2016', '2018', '2020'];
  // Map from slug → { modelCode, season (may be null) }
  const products = new Map();

  for (const year of years) {
    const url = `https://web.archive.org/web/${year}/https://acrnm.com/`;
    console.log(`Fetching homepage (${year})...`);
    const html = fetchViaProxy(url);
    if (html) {
      const found = extractProductSlugs(html);
      found.forEach(s => {
        if (!products.has(s)) {
          products.set(s, parseEra2Slug(s));
        }
      });
      console.log(`  Found ${found.length} product links in ${year} snapshot`);
    }
  }

  return products;
}

// ─── Supabase query ───────────────────────────────────────────────────────────

async function getAcronymProductsFromDB() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let allProducts = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('objects')
      .select('id, name, season, model_code, source_url')
      .eq('brand', 'acronym')
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) break;

    allProducts = allProducts.concat(data);
    offset += pageSize;
    if (data.length < pageSize) break;
  }

  console.log(`Loaded ${allProducts.length} ACRONYM products from DB`);
  return allProducts;
}

// ─── Build DB lookup maps ─────────────────────────────────────────────────────

function buildDbLookups(dbProducts) {
  // Index by model_code (uppercase)
  const byModelCode = {};
  // Index by Shopify slug extracted from source_url
  const byShopifySlug = {};
  // Index by name (uppercase, stripped)
  const byName = {};

  for (const p of dbProducts) {
    if (p.model_code) {
      byModelCode[p.model_code.toUpperCase()] = p;
    }

    if (p.name) {
      byName[p.name.toUpperCase().split('/')[0].trim()] = p;
    }

    // Extract Shopify slug from source_url like:
    //   http://www.acrnm.com:80/products/gt-j28  → gt-j28
    //   http://www.acrnm.com:80/collections/xxx/products/slug → slug
    //   https://acrnm.com/products/GT-J28_FW12 → gt-j28 (normalize by removing season suffix)
    if (p.source_url) {
      const m = /\/products\/([^/?#\s]+)/i.exec(p.source_url);
      if (m) {
        // Remove season suffix like _FW12 or _SS15 at the end
        let slug = m[1].replace(/_[A-Z]{2}\d{2,4}$/i, '').toLowerCase();
        byShopifySlug[slug] = p;
      }
    }
  }

  function find(waybackSlug) {
    const lower = waybackSlug.toLowerCase();
    const upper = waybackSlug.toUpperCase();

    // 1. Direct Shopify slug match (most reliable for old products)
    if (byShopifySlug[lower]) return { product: byShopifySlug[lower], matchType: 'shopify_slug' };

    // 2. model_code match (uppercase)
    if (byModelCode[upper]) return { product: byModelCode[upper], matchType: 'model_code' };

    // 3. Name match
    if (byName[upper]) return { product: byName[upper], matchType: 'name' };

    // 4. Partial model_code match — e.g. "nts-ng1" matches "NTS-NG1"
    const upperNorm = upper.replace(/-/g, '');
    for (const [key, p] of Object.entries(byModelCode)) {
      if (key.replace(/-/g, '') === upperNorm) return { product: p, matchType: 'model_code_fuzzy' };
    }

    return null;
  }

  return { byModelCode, byShopifySlug, byName, find };
}

// ─── Cross-validation ─────────────────────────────────────────────────────────

function crossValidate(seasonSlugs, dbProducts) {
  const mismatches = [];
  const missingFromDb = [];
  const verified = [];

  const { find } = buildDbLookups(dbProducts);

  for (const [season, slugSet] of Object.entries(seasonSlugs)) {
    for (const slug of [...slugSet].sort()) {
      const result = find(slug);

      if (!result) {
        missingFromDb.push({
          product: slug,
          expected_season: season,
          source_collection: Object.entries(COLLECTION_SEASON_MAP).find(([, s]) => s === season)?.[0] || season,
          model_code_guess: slug.toUpperCase(),
        });
      } else {
        const { product: p, matchType } = result;
        const dbSeason = p.season;

        if (!dbSeason) {
          mismatches.push({
            product: slug,
            db_name: p.name,
            db_model_code: p.model_code,
            collection_season: season,
            db_season: null,
            issue: 'missing_season_in_db',
            match_type: matchType,
          });
        } else if (dbSeason !== season) {
          mismatches.push({
            product: slug,
            db_name: p.name,
            db_model_code: p.model_code,
            collection_season: season,
            db_season: dbSeason,
            issue: 'season_mismatch',
            match_type: matchType,
          });
        } else {
          verified.push({
            product: slug,
            db_name: p.name,
            db_model_code: p.model_code,
            season: season,
            match_type: matchType,
          });
        }
      }
    }
  }

  return { mismatches, missingFromDb, verified };
}

// ─── Check all-products slugs for products not in DB ─────────────────────────

function findMissingFromAllProducts(allSlugs, dbProducts, alreadyReportedMissing) {
  const { find } = buildDbLookups(dbProducts);
  const reportedSlugs = new Set(alreadyReportedMissing.map(m => m.product));
  const extraMissing = [];
  const extraMismatches = [];

  for (const slug of [...allSlugs].sort()) {
    if (reportedSlugs.has(slug)) continue;

    // Parse potential era2 slug: MODEL_SEASON format
    const parsed = parseEra2Slug(slug);
    const modelCode = parsed.modelCode;
    const slugSeason = parsed.season; // may be null

    // Try to find in DB using model code (strip season suffix)
    const modelCodeLower = modelCode.toLowerCase();
    let result = find(modelCodeLower);

    // If not found with stripped model code, try the full slug
    if (!result) result = find(slug);

    if (!result) {
      extraMissing.push({
        product: slug,
        model_code_guess: modelCode,
        expected_season: slugSeason || 'UNKNOWN',
        source_collection: 'acronym-all/all-products/homepage',
        notes: slugSeason ? `Season inferred from slug: ${slugSeason}` : 'No season info',
      });
    } else if (slugSeason && result.product.season && result.product.season !== slugSeason) {
      // We have season info from slug and it disagrees with DB
      extraMismatches.push({
        product: slug,
        db_name: result.product.name,
        db_model_code: result.product.model_code,
        collection_season: slugSeason,
        db_season: result.product.season,
        issue: 'season_mismatch_from_homepage_slug',
        match_type: result.matchType,
        source: 'homepage_snapshot',
      });
    }
  }

  return { extraMissing, extraMismatches };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== ACRONYM Season Cross-Validation ===\n');

  // Step 1: Load local listing files
  console.log('Step 1: Loading local Wayback listing HTML files...');
  const { seasonSlugs, allSlugs } = loadLocalListings();

  console.log('\nProducts found per season from Wayback:');
  for (const [season, slugs] of Object.entries(seasonSlugs).sort()) {
    console.log(`  ${season}: ${slugs.size} products — ${[...slugs].sort().join(', ')}`);
  }
  console.log(`\nAll-products/acronym-all listing slugs: ${allSlugs.size}`);

  // Step 2: Fetch homepage snapshots
  console.log('\nStep 2: Fetching Wayback homepage snapshots...');
  const homepageProducts = fetchHomepageProducts(); // Map<slug, {modelCode, season}>
  console.log(`  Total homepage product slugs: ${homepageProducts.size}`);
  // Add homepage slugs to allSlugs pool (preserving the full slug with season suffix)
  homepageProducts.forEach((info, slug) => allSlugs.add(slug));
  console.log(`  Combined all-products pool: ${allSlugs.size}`);

  // Step 3: Query Supabase
  console.log('\nStep 3: Querying Supabase for ACRONYM products...');
  const dbProducts = await getAcronymProductsFromDB();

  // Print DB breakdown by season
  const dbSeasonGroups = {};
  for (const p of dbProducts) {
    const s = p.season || 'NO_SEASON';
    if (!dbSeasonGroups[s]) dbSeasonGroups[s] = [];
    dbSeasonGroups[s].push(p);
  }

  console.log('\nDB ACRONYM products by season:');
  for (const [season, products] of Object.entries(dbSeasonGroups).sort()) {
    // Only show early seasons in detail
    const earlySeasons = ['SS12', 'FW12', 'SS13', 'FW13', 'SS14', 'FW14', 'SS15', 'NO_SEASON'];
    if (earlySeasons.includes(season)) {
      console.log(`  ${season}: ${products.length} products`);
      products.forEach(p => console.log(`    ${p.model_code || '(no model_code)'} — ${p.name}`));
    } else {
      console.log(`  ${season}: ${products.length} products`);
    }
  }

  // Step 4: Cross-validate seasonal collections
  console.log('\nStep 4: Cross-validating seasonal collections...');
  const { mismatches, missingFromDb, verified } = crossValidate(seasonSlugs, dbProducts);

  // Step 5: Check all-products for additional missing items
  console.log('\nStep 5: Checking all-products pool for additional gaps...');
  const { extraMissing, extraMismatches } = findMissingFromAllProducts(allSlugs, dbProducts, missingFromDb);
  const allMissing = [...missingFromDb, ...extraMissing];
  const allMismatches = [...mismatches, ...extraMismatches];

  // ─── Output ──────────────────────────────────────────────────────────────────

  const results = {
    generated_at: new Date().toISOString(),
    summary: {
      total_db_acronym_products: dbProducts.length,
      seasonal_wayback_products: Object.fromEntries(
        Object.entries(seasonSlugs).map(([s, slugs]) => [s, slugs.size])
      ),
      total_all_products_listing: allSlugs.size,
      verified_count: verified.length,
      mismatch_count: allMismatches.length,
      mismatch_seasonal_count: mismatches.length,
      mismatch_homepage_slug_count: extraMismatches.length,
      missing_from_db_count: allMissing.length,
      missing_seasonal_count: missingFromDb.length,
      missing_all_products_count: extraMissing.length,
    },
    mismatches: allMismatches,
    missing_from_db: allMissing,
    verified,
    db_season_breakdown: Object.fromEntries(
      Object.entries(dbSeasonGroups).sort().map(([s, ps]) => [s, ps.length])
    ),
    wayback_season_breakdown: Object.fromEntries(
      Object.entries(seasonSlugs).map(([s, slugs]) => [s, [...slugs].sort()])
    ),
    all_wayback_slugs: [...allSlugs].sort(),
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${OUTPUT_FILE}`);

  // ─── Human-readable summary ───────────────────────────────────────────────────

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`DB ACRONYM products total:     ${results.summary.total_db_acronym_products}`);
  console.log(`Wayback seasonal products:     ${Object.values(results.summary.seasonal_wayback_products).reduce((a, b) => a + b, 0)}`);
  console.log(`All-products pool total:       ${results.summary.total_all_products_listing}`);
  console.log(`Verified (season matches):     ${results.summary.verified_count}`);
  console.log(`Season mismatches (seasonal collections): ${results.summary.mismatch_seasonal_count}`);
  console.log(`Season mismatches (homepage slugs):       ${results.summary.mismatch_homepage_slug_count}`);
  console.log(`Total mismatches:              ${results.summary.mismatch_count}`);
  console.log(`Missing from DB (seasonal):    ${results.summary.missing_seasonal_count}`);
  console.log(`Missing from DB (all-prods):   ${results.summary.missing_all_products_count}`);
  console.log(`Missing from DB TOTAL:         ${results.summary.missing_from_db_count}`);

  if (allMismatches.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('SEASON MISMATCHES:');
    for (const m of allMismatches) {
      if (m.issue === 'season_mismatch' || m.issue === 'season_mismatch_from_homepage_slug') {
        console.log(`  [MISMATCH] ${m.product}`);
        console.log(`    DB: ${m.db_name} (model: ${m.db_model_code}, season: ${m.db_season})`);
        console.log(`    Wayback collection says: ${m.collection_season}`);
      } else {
        console.log(`  [NO SEASON] ${m.product}`);
        console.log(`    DB: ${m.db_name} (model: ${m.db_model_code}) — Wayback says: ${m.collection_season}`);
      }
    }
  }

  if (missingFromDb.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('MISSING FROM DB (from seasonal collections):');
    for (const m of missingFromDb) {
      console.log(`  [MISSING] ${m.product}  →  expected season: ${m.expected_season}  [${m.source_collection}]`);
    }
  }

  if (extraMissing.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('MISSING FROM DB (from all-products/homepage listings):');
    for (const m of extraMissing) {
      const seasonInfo = m.expected_season !== 'UNKNOWN' ? `  expected season: ${m.expected_season}` : '';
      console.log(`  [MISSING] ${m.product}${seasonInfo}  [${m.source_collection}]`);
    }
  }

  if (verified.length > 0) {
    console.log('\n' + '─'.repeat(60));
    console.log('VERIFIED (season correct in DB):');
    for (const v of verified) {
      console.log(`  [OK] ${v.product} → ${v.db_name} (${v.db_model_code}) : ${v.season}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
