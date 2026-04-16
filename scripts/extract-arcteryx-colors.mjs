#!/usr/bin/env node
/**
 * Extract model_group and color_name from Arc'teryx resale URLs.
 * Fully sequential — one update at a time to avoid connection pool exhaustion.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://soowdirfqjwggvijdquz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvb3dkaXJmcWp3Z2d2aWpkcXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUwNzI2MCwiZXhwIjoyMDg5MDgzMjYwfQ.4pqKaT_8gkKStYBEjlo0uWvjS4BNNdlCOv2GWVZATNw';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function parseResaleUrl(url) {
  if (!url) return null;
  const m = url.match(/products\/(.+?)_(\w+)_(.+?)$/);
  if (!m) return null;
  return { model_group: m[1], sku: m[2], color_name: m[3] };
}

function prettifyColor(raw) {
  return raw.split('-').map(w => {
    if (w === 'smu') return 'SMU';
    if (w === 'lt') return 'LT';
    if (w === 'dk') return 'DK';
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ').replace(/ \d+$/, '');
}

function prettifyModelGroup(slug) {
  return slug.split('-').map(w => {
    if (w === 'mens') return "Men's";
    if (w === 'womens') return "Women's";
    if (['ss', 'ls', 'ar', 'lt', 'sv', 'fl', 'sl', 'mx', 'gtx'].includes(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

const delay = ms => new Promise(r => setTimeout(r, ms));

async function fetchPage(offset, limit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await sb.from('objects')
      .select('id, source_url, structured_data')
      .eq('brand', 'arcteryx')
      .like('source_url', '%resale.arcteryx%')
      .range(offset, offset + limit - 1);
    if (data) return data;
    console.error(`  Fetch attempt ${attempt + 1} failed:`, error?.message);
    await delay(2000);
  }
  return [];
}

async function main() {
  console.log('Fetching arcteryx resale items in pages...');

  let all = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const data = await fetchPage(offset, PAGE);
    if (data.length === 0) break;
    all.push(...data);
    process.stdout.write(`\rFetched: ${all.length}`);
    offset += data.length;
    if (data.length < PAGE) break;
    await delay(300);
  }
  console.log(`\nTotal resale items: ${all.length}`);

  // Filter to only items that need update (no model_group in structured_data)
  const needsUpdate = all.filter(item => {
    const sd = item.structured_data;
    if (!sd) return true;
    if (typeof sd === 'object' && sd.model_group) return false; // Already done
    return true;
  });

  // Parse URLs and build update list
  const updates = [];
  for (const item of needsUpdate) {
    const result = parseResaleUrl(item.source_url);
    if (!result) continue;
    const existing = (item.structured_data && typeof item.structured_data === 'object') ? item.structured_data : {};
    updates.push({
      id: item.id,
      structured_data: {
        ...existing,
        model_group: result.model_group,
        model_group_display: prettifyModelGroup(result.model_group),
        color_name: prettifyColor(result.color_name),
        color_slug: result.color_name,
      },
    });
  }

  const alreadyDone = all.length - needsUpdate.length;
  console.log(`Already done: ${alreadyDone}, Need update: ${updates.length}`);

  // Sequential updates with small parallel batches of 5
  let updated = 0, errors = 0;
  const BATCH = 5;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(u => sb.from('objects').update({ structured_data: u.structured_data }).eq('id', u.id))
    );

    for (const r of results) {
      if (r.error) {
        errors++;
        if (errors <= 5) console.error(`\n  Error: ${r.error.message}`);
      } else {
        updated++;
      }
    }
    process.stdout.write(`\r  Updated ${updated}/${updates.length} (${errors} errors)`);
    // Small delay every 50 to be nice to the pool
    if (i % 50 === 0 && i > 0) await delay(100);
  }

  console.log(`\n\nDone! Updated: ${updated}, Errors: ${errors}, Already done: ${alreadyDone}`);
  console.log(`Total with colorway data: ${alreadyDone + updated} / ${all.length}`);
}

main().catch(console.error);
