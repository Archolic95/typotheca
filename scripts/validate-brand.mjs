#!/usr/bin/env node
/**
 * Brand Validation Pipeline v2
 *
 * A 3-gate validation system that uses the homepage master inventory
 * (from recursive homepage/collection page scraping) as the authoritative
 * source of truth, cross-referenced with CDX product page data and the DB.
 *
 * Architecture:
 *   Gate 1: DISCOVERY  — Homepage inventory vs DB: are all known products in the DB?
 *   Gate 2: DATA       — For products IN the DB, do they have complete structured data?
 *   Gate 3: IMAGES     — For products IN the DB, do they have images?
 *
 * Usage:
 *   node scripts/validate-brand.mjs acronym
 *   node scripts/validate-brand.mjs acronym --fix    # auto-insert missing products, fill gaps
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// ── Load env ──────────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .map(([k, ...v]) => [k, v.join('=')])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// ── Brand Configurations ──────────────────────────────────────────────
const BRAND_CONFIGS = {
  acronym: {
    brand: 'acronym',
    cacheDir: '/tmp/wayback-acrnm',
    masterInventoryPath: '/tmp/wayback-acrnm/homepage_master_inventory.json',
    newProductsPath: '/tmp/wayback-acrnm/homepage_new_products.json',

    // Normalize a homepage inventory item to DB-matchable keys
    inventoryToDbKey(item) {
      const model = (item.model || item.slug || '').toUpperCase();
      const season = item.season || null;
      return { name: model, season };
    },

    // Categorize a DB product into expected-data tiers
    // Tier 1: acrnm.com products — should have images + structured_data
    // Tier 2: secondary market — may have images, unlikely to have structured_data
    // Tier 3: lookbooks/media — not expected to have product data
    categorizeTier(product) {
      const name = product.name || '';
      if (name.includes('Lookbook') || name.startsWith('IMG-') ||
          name.startsWith('V2') && name.length <= 6 || name.startsWith('V3') && name.length <= 6) {
        return 3; // media
      }
      const src = product.source_site || '';
      if (src === 'acrnm.com' || src === 'web.archive.org') return 1;
      return 2; // secondary market
    },

    // Rich fields expected in structured_data for tier-1 products
    richFields: ['description', 'fabric_technology', 'sizing', 'systems', 'subsystems',
                 'includes', 'interface_with', 'image_annotations'],
  },
};

// ── Gate 1: Discovery — Homepage Inventory vs DB ─────────────────────
async function gate1_discovery(config) {
  console.log('\n' + '═'.repeat(70));
  console.log('GATE 1: DISCOVERY — Homepage Inventory vs DB');
  console.log('═'.repeat(70));

  // Load homepage master inventory
  if (!existsSync(config.masterInventoryPath)) {
    console.log(`  ❌ Master inventory not found at ${config.masterInventoryPath}`);
    console.log(`  Run the homepage scraper first: node /tmp/wayback-acrnm/homepage_scraper.mjs`);
    return { pass: false, inventory: [], dbProducts: [], dbLookup: new Map() };
  }

  const inventory = JSON.parse(readFileSync(config.masterInventoryPath, 'utf-8'));
  console.log(`  Homepage master inventory: ${inventory.length} products`);

  // Load new products list if available
  let newProducts = [];
  if (existsSync(config.newProductsPath)) {
    newProducts = JSON.parse(readFileSync(config.newProductsPath, 'utf-8'));
  }

  // Get all DB products for this brand
  const { data: dbProducts, error } = await supabase
    .from('objects')
    .select('id, name, season, source_site, image_urls, structured_data')
    .eq('brand', config.brand);
  if (error) { console.error('  DB error:', error.message); return { pass: false }; }

  console.log(`  DB products: ${dbProducts.length}`);

  // Build DB lookup maps
  const dbByNameSeason = new Map(); // "NAME|SEASON" → product
  const dbByName = new Map();       // "NAME" → [products]
  for (const p of dbProducts) {
    dbByNameSeason.set(`${p.name}|${p.season || ''}`, p);
    if (!dbByName.has(p.name)) dbByName.set(p.name, []);
    dbByName.get(p.name).push(p);
  }

  // Match each inventory item to DB
  let matched = 0;
  const missingFromDb = [];
  const seasonMismatches = [];

  for (const item of inventory) {
    const key = config.inventoryToDbKey(item);
    const exactKey = `${key.name}|${key.season || ''}`;

    if (dbByNameSeason.has(exactKey)) {
      matched++;
      continue;
    }

    // Name-only match (might be a season mismatch)
    if (dbByName.has(key.name)) {
      const dbItems = dbByName.get(key.name);
      // Season mismatch — product exists but under different season
      seasonMismatches.push({
        ...item,
        dbName: key.name,
        expectedSeason: key.season,
        dbSeasons: dbItems.map(d => d.season),
        firstSeen: item.first_seen,
      });
      matched++; // still counts as discovered
      continue;
    }

    // Try stripping color suffixes (BLK, SVR, COR, etc.)
    const colorMatch = key.name.match(/^(.+?)-(BLK|SVR|COR|WHT|OLV|GRN|RED|BLU|GRY)$/);
    if (colorMatch && dbByName.has(colorMatch[1])) {
      matched++;
      continue;
    }

    // Try stripping -1 or -YEAR or -SEASON suffix
    const suffixMatch = key.name.match(/^(.+?)(?:-\d+|-\d{4}|-(SS|FW)\d{2,4})$/);
    if (suffixMatch && dbByName.has(suffixMatch[1])) {
      matched++;
      continue;
    }

    missingFromDb.push(item);
  }

  // Also check: DB products not in inventory (secondary market items, expected)
  const inventoryNames = new Set(inventory.map(i => (i.model || i.slug || '').toUpperCase()));
  const dbOnlyProducts = dbProducts.filter(p => !inventoryNames.has(p.name));
  const dbOnlyBySource = {};
  for (const p of dbOnlyProducts) {
    const src = p.source_site || 'unknown';
    dbOnlyBySource[src] = (dbOnlyBySource[src] || 0) + 1;
  }

  console.log(`\n  Inventory → DB matched: ${matched}/${inventory.length}`);
  console.log(`  Missing from DB: ${missingFromDb.length}`);
  console.log(`  Season mismatches: ${seasonMismatches.length}`);
  console.log(`  DB-only products (not on homepage): ${dbOnlyProducts.length}`);

  if (Object.keys(dbOnlyBySource).length > 0) {
    console.log(`\n  ┌── DB-Only by Source (expected for secondary market) ─`);
    for (const [src, count] of Object.entries(dbOnlyBySource).sort((a, b) => b[1] - a[1])) {
      console.log(`  │ ${src.padEnd(30)} ${count}`);
    }
    console.log(`  └──────────────────────────────────────────────────────`);
  }

  if (missingFromDb.length > 0) {
    console.log(`\n  ┌── Missing from DB ──────────────────────────────`);
    for (const item of missingFromDb.slice(0, 30)) {
      const model = (item.model || item.slug || '?').toUpperCase();
      console.log(`  │ ${model.padEnd(20)} ${(item.season || '??').padEnd(6)} first: ${item.first_seen || '?'} ${item.subtitle ? '| ' + item.subtitle.substring(0, 40) : ''}`);
    }
    if (missingFromDb.length > 30) console.log(`  │ ... and ${missingFromDb.length - 30} more`);
    console.log(`  └────────────────────────────────────────────────────`);
  }

  if (seasonMismatches.length > 0) {
    console.log(`\n  ┌── Season Mismatches (homepage says different season) ─`);
    for (const item of seasonMismatches.slice(0, 20)) {
      console.log(`  │ ${item.dbName.padEnd(15)} homepage: ${(item.expectedSeason || '??').padEnd(6)} DB: ${item.dbSeasons.join(',')} first_seen: ${item.firstSeen || '?'}`);
    }
    if (seasonMismatches.length > 20) console.log(`  │ ... and ${seasonMismatches.length - 20} more`);
    console.log(`  └──────────────────────────────────────────────────────`);
  }

  const pass = missingFromDb.length === 0;
  console.log(`\n  Gate 1: ${pass ? '✅ PASS' : '❌ FAIL — ' + missingFromDb.length + ' products not in DB'}`);
  return { pass, inventory, missingFromDb, seasonMismatches, dbProducts, dbByNameSeason, dbByName };
}

// ── Gate 2: Data Completeness ──────────────────────────────────────────
async function gate2_data(config, gate1Result) {
  console.log('\n' + '═'.repeat(70));
  console.log('GATE 2: DATA — Structured Data Completeness');
  console.log('═'.repeat(70));

  const { dbProducts } = gate1Result;

  // Categorize products by tier
  const tiers = { 1: [], 2: [], 3: [] };
  for (const p of dbProducts) {
    const tier = config.categorizeTier(p);
    tiers[tier].push(p);
  }

  console.log(`  Tier 1 (acrnm.com products): ${tiers[1].length}`);
  console.log(`  Tier 2 (secondary market):   ${tiers[2].length}`);
  console.log(`  Tier 3 (lookbooks/media):    ${tiers[3].length}`);

  // Check structured_data presence by tier
  for (const [tier, products] of Object.entries(tiers)) {
    if (products.length === 0) continue;
    const withSD = products.filter(p => p.structured_data && typeof p.structured_data === 'object' && Object.keys(p.structured_data).length > 0);
    const rate = ((withSD.length / products.length) * 100).toFixed(0);
    const marker = parseInt(rate) >= 90 ? '✅' : parseInt(rate) >= 70 ? '⚠️' : '❌';
    console.log(`\n  ${marker} Tier ${tier} structured_data: ${withSD.length}/${products.length} (${rate}%)`);

    // For tier 1, show which products are missing SD
    if (tier === '1') {
      const missing = products.filter(p => !p.structured_data || typeof p.structured_data !== 'object' || Object.keys(p.structured_data).length === 0);
      if (missing.length > 0 && missing.length <= 30) {
        for (const p of missing) {
          console.log(`    - ${p.name} ${p.season || ''}`);
        }
      } else if (missing.length > 30) {
        for (const p of missing.slice(0, 15)) {
          console.log(`    - ${p.name} ${p.season || ''}`);
        }
        console.log(`    ... and ${missing.length - 15} more`);
      }
    }
  }

  // Rich field analysis for tier 1 only
  const tier1 = tiers[1];
  if (tier1.length > 0 && config.richFields) {
    console.log(`\n  ┌── Tier 1 Rich Field Completeness ─────────────`);
    console.log(`  │ ${'Field'.padEnd(25)} ${'Present'.padStart(7)} ${'Missing'.padStart(7)} ${'Rate'.padStart(6)}`);
    console.log(`  │ ${'─'.repeat(50)}`);

    for (const field of config.richFields) {
      let present = 0;
      for (const p of tier1) {
        const sd = (p.structured_data && typeof p.structured_data === 'object') ? p.structured_data : {};
        if (sd[field] || (field === 'fabric_technology' && sd.fabric)) present++;
      }
      const rate = ((present / tier1.length) * 100).toFixed(0);
      const marker = parseInt(rate) >= 80 ? '✅' : parseInt(rate) >= 50 ? '⚠️' : '❌';
      console.log(`  │ ${marker} ${field.padEnd(23)} ${String(present).padStart(7)} ${String(tier1.length - present).padStart(7)} ${(rate + '%').padStart(6)}`);
    }
    console.log(`  └────────────────────────────────────────────────`);
  }

  const tier1WithSD = tiers[1].filter(p => p.structured_data && typeof p.structured_data === 'object' && Object.keys(p.structured_data).length > 0);
  const tier1Rate = tier1.length > 0 ? (tier1WithSD.length / tier1.length * 100) : 100;
  const pass = tier1Rate >= 90;
  console.log(`\n  Gate 2: ${pass ? '✅ PASS' : '❌ FAIL'} (Tier 1 SD rate: ${tier1Rate.toFixed(0)}%, threshold: 90%)`);
  return { pass, tiers };
}

// ── Gate 3: Image Completeness ─────────────────────────────────────────
async function gate3_images(config, gate1Result) {
  console.log('\n' + '═'.repeat(70));
  console.log('GATE 3: IMAGES — Image Completeness');
  console.log('═'.repeat(70));

  const { dbProducts } = gate1Result;

  // Categorize
  const tiers = { 1: [], 2: [], 3: [] };
  for (const p of dbProducts) {
    tiers[config.categorizeTier(p)].push(p);
  }

  const hasRealImages = (p) => p.image_urls && p.image_urls.length > 0 &&
    p.image_urls.some(u => !u.includes('/videos/'));

  for (const [tier, products] of Object.entries(tiers)) {
    if (products.length === 0) continue;
    const withImg = products.filter(hasRealImages);
    const rate = ((withImg.length / products.length) * 100).toFixed(0);
    const marker = parseInt(rate) >= 90 ? '✅' : parseInt(rate) >= 70 ? '⚠️' : '❌';
    console.log(`  ${marker} Tier ${tier} images: ${withImg.length}/${products.length} (${rate}%)`);

    if (tier === '1') {
      const missing = products.filter(p => !hasRealImages(p));
      if (missing.length > 0 && missing.length <= 30) {
        for (const p of missing) {
          console.log(`    - ${p.name} ${p.season || ''} (source: ${p.source_site || '?'})`);
        }
      } else if (missing.length > 30) {
        for (const p of missing.slice(0, 15)) {
          console.log(`    - ${p.name} ${p.season || ''} (source: ${p.source_site || '?'})`);
        }
        console.log(`    ... and ${missing.length - 15} more`);
      }
    }
  }

  // Image source breakdown for tier 1
  const tier1 = tiers[1];
  if (tier1.length > 0) {
    const imgStats = { r2: 0, wayback: 0, shopify: 0, other: 0, none: 0 };
    for (const p of tier1) {
      if (!hasRealImages(p)) { imgStats.none++; continue; }
      const firstImg = p.image_urls.find(u => !u.includes('/videos/')) || '';
      if (firstImg.includes('r2.dev')) imgStats.r2++;
      else if (firstImg.includes('web.archive.org')) imgStats.wayback++;
      else if (firstImg.includes('shopify')) imgStats.shopify++;
      else imgStats.other++;
    }
    console.log(`\n  ┌── Tier 1 Image Sources ──────────────────────`);
    for (const [src, count] of Object.entries(imgStats)) {
      if (count > 0) console.log(`  │ ${src.padEnd(20)} ${count}`);
    }
    console.log(`  └────────────────────────────────────────────────`);
  }

  // Overall coverage matrix
  console.log(`\n  ┌── Coverage Matrix (all tiers) ────────────────`);
  const matrix = {};
  for (const p of dbProducts) {
    const hasImg = hasRealImages(p) ? 'yes' : 'no';
    const hasSD = (p.structured_data && typeof p.structured_data === 'object' && Object.keys(p.structured_data).length > 0) ? 'yes' : 'no';
    const key = `images:${hasImg} sd:${hasSD}`;
    matrix[key] = (matrix[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(matrix).sort((a, b) => b[1] - a[1])) {
    console.log(`  │ ${key.padEnd(30)} ${count}`);
  }
  console.log(`  └────────────────────────────────────────────────`);

  const tier1WithImg = tiers[1].filter(hasRealImages);
  const tier1Rate = tier1.length > 0 ? (tier1WithImg.length / tier1.length * 100) : 100;
  const pass = tier1Rate >= 90;
  console.log(`\n  Gate 3: ${pass ? '✅ PASS' : '❌ FAIL'} (Tier 1 image rate: ${tier1Rate.toFixed(0)}%, threshold: 90%)`);
  return { pass, tiers };
}

// ── Fix Mode ───────────────────────────────────────────────────────────
async function autoFix(config, gate1Result) {
  console.log('\n' + '═'.repeat(70));
  console.log('AUTO-FIX MODE');
  console.log('═'.repeat(70));

  const { missingFromDb, seasonMismatches, inventory, dbByNameSeason } = gate1Result;
  let fixes = 0;

  // 1. Insert missing products
  if (missingFromDb.length > 0) {
    console.log(`\n  Inserting ${missingFromDb.length} missing products...`);
    for (const item of missingFromDb) {
      const model = (item.model || item.slug || '').toUpperCase();
      const season = item.season || null;
      const sd = {};
      if (item.subtitle) sd.subtitle = item.subtitle;
      if (item.type) sd.type = item.type;
      if (item.generation) sd.generation = item.generation;
      if (item.price_eur) sd.price_eur = item.price_eur;
      if (item.colors && item.colors.length) sd.colors = item.colors;
      if (item.first_seen) sd.homepage_first_seen = item.first_seen;

      const thumbnails = (item.thumbnail_urls || []).filter(u => u && u.length > 0);

      const sourceUrl = `https://acrnm.com/products/${model}${season ? '_' + season : ''}`;
      const { error } = await supabase.from('objects').insert({
        name: model,
        season,
        brand: config.brand,
        source_site: 'acrnm.com',
        source_url: sourceUrl,
        structured_data: Object.keys(sd).length > 0 ? sd : null,
        image_urls: thumbnails.length > 0 ? thumbnails : null,
        category_1: model.startsWith('3A-') ? 'Accessories' :
                    model.match(/^[JLDW]/) ? 'Clothing' :
                    model.startsWith('P') ? 'Clothing' :
                    model.startsWith('S') && !model.startsWith('SS-') ? 'Accessories' :
                    model.startsWith('LF') || model.startsWith('DAF') ? 'Shoe' : null,
      });
      if (error) {
        console.log(`    ❌ ${model} ${season}: ${error.message}`);
      } else {
        console.log(`    ✅ ${model} ${season}`);
        fixes++;
      }
    }
  }

  // 2. Fix season mismatches (only if homepage evidence is strong)
  if (seasonMismatches.length > 0) {
    console.log(`\n  Checking ${seasonMismatches.length} season mismatches...`);
    for (const item of seasonMismatches) {
      // Only fix if the DB has exactly one entry and the homepage season differs
      if (item.dbSeasons.length === 1 && item.expectedSeason && item.expectedSeason !== item.dbSeasons[0]) {
        const dbKey = `${item.dbName}|${item.dbSeasons[0]}`;
        const dbProduct = dbByNameSeason.get(dbKey);
        if (dbProduct) {
          console.log(`    ${item.dbName}: ${item.dbSeasons[0]} → ${item.expectedSeason} (first seen: ${item.firstSeen})`);
          // Don't auto-fix seasons — too risky. Just report.
        }
      }
    }
    console.log(`  (Season fixes are reported only — apply manually after review)`);
  }

  // 3. Enrich DB products with homepage metadata
  console.log(`\n  Enriching DB products with homepage metadata...`);
  let enriched = 0;
  for (const item of inventory) {
    const key = config.inventoryToDbKey(item);
    const exactKey = `${key.name}|${key.season || ''}`;
    const dbProduct = dbByNameSeason.get(exactKey);
    if (!dbProduct) continue;

    const sd = (dbProduct.structured_data && typeof dbProduct.structured_data === 'object')
      ? { ...dbProduct.structured_data } : {};
    let changed = false;

    if (item.subtitle && !sd.subtitle) { sd.subtitle = item.subtitle; changed = true; }
    if (item.type && !sd.type) { sd.type = item.type; changed = true; }
    if (item.generation && !sd.generation && !sd.gen) { sd.generation = item.generation; changed = true; }
    if (item.price_eur && !sd.price_eur) { sd.price_eur = String(item.price_eur); changed = true; }
    if (item.colors && item.colors.length > 0 && !sd.colors) { sd.colors = item.colors; changed = true; }
    if (item.first_seen && !sd.homepage_first_seen) { sd.homepage_first_seen = item.first_seen; changed = true; }

    if (changed) {
      await supabase.from('objects').update({ structured_data: sd }).eq('id', dbProduct.id);
      enriched++;
    }
  }
  console.log(`  Enriched ${enriched} products with homepage metadata`);
  fixes += enriched;

  console.log(`\n  Total fixes applied: ${fixes}`);
  return fixes;
}

// ── Summary ────────────────────────────────────────────────────────────
function printSummary(brandName, config, g1, g2, g3) {
  console.log('\n' + '═'.repeat(70));
  console.log(`VALIDATION SUMMARY: ${brandName.toUpperCase()}`);
  console.log('═'.repeat(70));
  console.log(`  Gate 1 (Discovery):  ${g1.pass ? '✅ PASS' : '❌ FAIL — ' + g1.missingFromDb?.length + ' products not in DB'}`);
  console.log(`  Gate 2 (Data):       ${g2.pass ? '✅ PASS' : '❌ FAIL — Tier 1 SD rate below 90%'}`);
  console.log(`  Gate 3 (Images):     ${g3.pass ? '✅ PASS' : '❌ FAIL — Tier 1 image rate below 90%'}`);
  console.log('═'.repeat(70));

  const allPass = g1.pass && g2.pass && g3.pass;
  console.log(`\n  Overall: ${allPass ? '✅ ALL GATES PASS' : '❌ GAPS REMAIN'}\n`);

  // Write report
  const report = {
    brand: brandName,
    timestamp: new Date().toISOString(),
    gate1: {
      pass: g1.pass,
      inventorySize: g1.inventory?.length,
      dbSize: g1.dbProducts?.length,
      missingFromDb: g1.missingFromDb?.length || 0,
      seasonMismatches: g1.seasonMismatches?.length || 0,
    },
    gate2: { pass: g2.pass },
    gate3: { pass: g3.pass },
    allPass,
  };

  const reportPath = `${config.cacheDir}/validation_report.json`;
  try { writeFileSync(reportPath, JSON.stringify(report, null, 2)); } catch { /* */ }
  const reportPath2 = `/tmp/validation_${brandName}.json`;
  writeFileSync(reportPath2, JSON.stringify(report, null, 2));
  console.log(`  Report saved to ${reportPath2}`);
  return allPass;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const brandName = args[0];
  const fixMode = args.includes('--fix');

  if (!brandName || !BRAND_CONFIGS[brandName]) {
    console.error(`Usage: node scripts/validate-brand.mjs <brand> [--fix]`);
    console.error(`Available brands: ${Object.keys(BRAND_CONFIGS).join(', ')}`);
    process.exit(1);
  }

  const config = BRAND_CONFIGS[brandName];
  console.log(`\nValidating brand: ${brandName.toUpperCase()}`);
  console.log(`Cache dir: ${config.cacheDir}`);
  console.log(`Master inventory: ${config.masterInventoryPath}`);
  if (fixMode) console.log('⚡ Fix mode enabled');

  const g1 = await gate1_discovery(config);
  const g2 = await gate2_data(config, g1);
  const g3 = await gate3_images(config, g1);

  if (fixMode && (!g1.pass || !g2.pass || !g3.pass)) {
    await autoFix(config, g1);
  }

  printSummary(brandName, config, g1, g2, g3);
}

main().catch(e => { console.error(e); process.exit(1); });
