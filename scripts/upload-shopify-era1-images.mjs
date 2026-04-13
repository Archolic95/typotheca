/**
 * Upload Era 1 (Shopify 2012-2015) cached images to R2 and update Supabase.
 *
 * Reads cached JSON from /tmp/wayback-acrnm/, downloads images via Wayback Machine,
 * uploads to R2, and updates the objects table image_urls column.
 *
 * Usage:
 *   node scripts/upload-shopify-era1-images.mjs [--dry-run] [--limit N]
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────
const R2_PUBLIC_URL = 'https://pub-885ce5051638470a823dcbace49705ad.r2.dev';
const SUPABASE_URL = 'https://soowdirfqjwggvijdquz.supabase.co';

// Read service key from .env.local
const envPath = '/Users/runjiatian/Desktop/typotheca/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_KEY = envContent.match(/SUPABASE_SERVICE_KEY=(.+)/)?.[1]?.trim();
if (!SUPABASE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY in .env.local');

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://be49199763861ceb41bce11aa420bcbf.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '4c6148fa442275f3f7f48e3615332d80',
    secretAccessKey: '4b4f7c9d68887b3307770ae09b32920e3135742a738051058cb74c589c8327d7',
  },
});

const WAYBACK_DIR = '/tmp/wayback-acrnm';
const PROXY = 'http://oiDHj3tZvTPflP0w:6OMPPyyPUVuGuY8v@geo.iproyal.com:12321';
const RATE_LIMIT_MS = 600; // ~1.7/sec, under the 2/sec cap

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 0;

// ── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadImage(url, retries = 3) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 30000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        const loc = res.headers.location;
        if (loc) return downloadImage(loc, retries).then(resolve).catch(reject);
        return reject(new Error(`Redirect without location`));
      }
      if (res.statusCode === 429 || res.statusCode === 503) {
        if (retries > 0) {
          return sleep(5000).then(() => downloadImage(url, retries - 1)).then(resolve).catch(reject);
        }
        return reject(new Error(`HTTP ${res.statusCode} after retries`));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function uploadToR2(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: 'typotheca',
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

function getContentType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return types[ext] || 'image/jpeg';
}

async function r2KeyExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: 'typotheca', Key: key }));
    return true;
  } catch { return false; }
}

// ── Parse cached JSON files ─────────────────────────────────────────────────

function loadCachedProducts() {
  const files = fs.readdirSync(WAYBACK_DIR).filter(f => f.endsWith('.json'));
  const bySlug = new Map();

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(WAYBACK_DIR, f), 'utf8'));
      if (!data.images || !Array.isArray(data.images) || !data.slug) continue;

      const shopifyImgs = data.images.filter(u =>
        typeof u === 'string' && u.includes('cdn.shopify.com')
      );
      if (shopifyImgs.length === 0) continue;

      const slug = data.slug;
      const existing = bySlug.get(slug);

      // Prefer file with wayback_timestamp over product_ prefix files
      if (!existing || (data.wayback_timestamp && !existing.wayback_timestamp)) {
        bySlug.set(slug, { ...data, shopifyImgs, file: f });
      }
    } catch {}
  }

  return bySlug;
}

/**
 * Deduplicate Shopify images: for each unique base filename, pick the highest resolution variant.
 * Shopify suffixes: _compact (100x), _small (?, rare), _medium, _grande (~600x), _large, _1024x1024
 *
 * Handles two filename patterns:
 *   - Numeric: /products/1234567_grande.jpeg
 *   - UUID: /products/01_d2c4b0a2-0601-4368-a422-9d64b27ae516_large.jpg
 */
function pickBestImages(shopifyImgs) {
  // Normalize: ensure https://
  const normalized = shopifyImgs.map(u => {
    if (u.startsWith('//')) return 'https:' + u;
    if (u.startsWith('http://')) return u.replace('http://', 'https://');
    return u;
  });

  const sizeRank = { '1024x1024': 6, 'grande': 5, 'large': 4, 'medium': 3, 'small': 2, 'compact': 1 };

  // Extract base ID and size from a Shopify product image URL
  function parseUrl(url) {
    const filename = url.split('/products/').pop();
    if (!filename) return null;

    // Strip extension
    const dotIdx = filename.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const namepart = filename.substring(0, dotIdx);

    // Try to find a known size suffix at the end: _1024x1024, _grande, _large, _compact, etc.
    for (const [size, rank] of Object.entries(sizeRank)) {
      if (namepart.endsWith('_' + size)) {
        const base = namepart.substring(0, namepart.length - size.length - 1);
        return { base, rank, size };
      }
    }
    // No recognized size suffix — treat as base with rank 0
    return { base: namepart, rank: 0, size: 'original' };
  }

  // Group by base, pick highest rank
  const byBase = new Map();
  for (const url of normalized) {
    const parsed = parseUrl(url);
    if (!parsed) continue;
    const existing = byBase.get(parsed.base);
    if (!existing || parsed.rank > existing.rank) {
      byBase.set(parsed.base, { url, rank: parsed.rank });
    }
  }

  return [...byBase.values()].map(v => v.url);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Upload Era 1 Shopify images (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  // 1. Load cached products
  const cached = loadCachedProducts();
  console.log(`Found ${cached.size} unique cached products with Shopify images`);

  // 2. Query Supabase for matching Acronym objects
  //    DB names are UPPERCASE versions of the slug
  const slugs = [...cached.keys()];
  const upperNames = slugs.map(s => s.toUpperCase());

  // Fetch all acronym objects to match
  let allObjects = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await sb.from('objects')
      .select('id, name, model_code, season, image_urls, source_site')
      .eq('brand', 'acronym')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error('Query error:', error); return; }
    allObjects = allObjects.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Fetched ${allObjects.length} acronym objects from DB`);

  // Build lookup: uppercase name -> object
  const objByName = new Map();
  for (const obj of allObjects) {
    objByName.set(obj.name, obj);
  }

  // Match cached slugs to DB objects
  const matches = [];
  const unmatched = [];

  for (const [slug, data] of cached) {
    const upperSlug = slug.toUpperCase();
    const obj = objByName.get(upperSlug);
    if (obj) {
      // Check if object already has R2 image URLs (not just videos)
      const hasR2Images = (obj.image_urls || []).some(u =>
        u.includes('r2.dev/') && !u.endsWith('.mp4') && !u.endsWith('.webm') && !u.includes('vimeo')
      );
      if (hasR2Images) {
        continue; // Already has images, skip
      }
      matches.push({ slug, data, obj });
    } else {
      unmatched.push(slug);
    }
  }

  console.log(`Matched ${matches.length} products needing images`);
  console.log(`Unmatched slugs: ${unmatched.length}`);
  if (unmatched.length > 0 && unmatched.length <= 20) {
    console.log('  Unmatched:', unmatched.join(', '));
  }

  if (limitArg && matches.length > limitArg) matches.length = limitArg;

  let fixed = 0;
  let totalImages = 0;
  let errors = [];

  for (let i = 0; i < matches.length; i++) {
    const { slug, data, obj } = matches[i];
    const bestImages = pickBestImages(data.shopifyImgs);
    const timestamp = data.wayback_timestamp || '20150101000000';
    const upperSlug = slug.toUpperCase();

    console.log(`\n[${i + 1}/${matches.length}] ${upperSlug} — ${bestImages.length} unique images (timestamp: ${timestamp})`);

    if (dryRun) {
      bestImages.slice(0, 3).forEach(u => console.log('  ' + u));
      fixed++;
      totalImages += bestImages.length;
      continue;
    }

    const newR2Urls = [];

    for (let j = 0; j < bestImages.length; j++) {
      const originalUrl = bestImages[j];
      const ext = originalUrl.split('?')[0].split('.').pop().toLowerCase();
      const validExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const r2Key = `acrnm/${upperSlug}/image-${j}.${validExt}`;

      // Check if already exists in R2
      if (await r2KeyExists(r2Key)) {
        console.log(`  [${j}] Already in R2, skipping`);
        newR2Urls.push(`${R2_PUBLIC_URL}/${r2Key}`);
        continue;
      }

      // Download directly from Shopify CDN (still live!) or fall back to Wayback
      const downloadUrl = originalUrl;
      const waybackUrl = `https://web.archive.org/web/${timestamp}im_/${originalUrl}`;

      try {
        await sleep(RATE_LIMIT_MS);
        let buffer;
        try {
          buffer = await downloadImage(downloadUrl);
        } catch (cdnErr) {
          // Fallback to Wayback
          console.log(`  [${j}] CDN failed (${cdnErr.message}), trying Wayback...`);
          buffer = await downloadImage(waybackUrl);
        }

        if (buffer.length < 500) {
          console.log(`  [${j}] Too small (${buffer.length}B), skipping`);
          continue;
        }

        const r2Url = await uploadToR2(r2Key, buffer, getContentType(originalUrl));
        newR2Urls.push(r2Url);
        console.log(`  [${j}] Uploaded ${(buffer.length / 1024).toFixed(0)}KB -> ${r2Key}`);
      } catch (err) {
        console.log(`  [${j}] Error: ${err.message}`);
      }
    }

    if (newR2Urls.length === 0) {
      console.log(`  No images downloaded, skipping DB update`);
      errors.push(`${upperSlug}: no images downloaded`);
      continue;
    }

    // Preserve existing video URLs
    const isVideo = u => u.endsWith('.mp4') || u.endsWith('.webm') || u.includes('vimeo.com') || u.includes('/file.mp4');
    const existingVideos = (obj.image_urls || []).filter(isVideo);
    const finalUrls = [...newR2Urls, ...existingVideos];

    const { error: updateErr } = await sb.from('objects')
      .update({ image_urls: finalUrls })
      .eq('id', obj.id);

    if (updateErr) {
      console.log(`  DB update error: ${updateErr.message}`);
      errors.push(`${upperSlug}: DB update failed - ${updateErr.message}`);
    } else {
      console.log(`  Updated DB: ${newR2Urls.length} images + ${existingVideos.length} videos`);
      fixed++;
      totalImages += newR2Urls.length;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done! Fixed: ${fixed}, Images added: ${totalImages}, Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log('  - ' + e));
  }
}

main().catch(console.error);
