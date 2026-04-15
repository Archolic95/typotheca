/**
 * Upgrade low-res Wayback images to high-res from live acrnm.com.
 *
 * Uses Playwright to fetch product pages (acrnm.com blocks non-browser requests).
 * Downloads high-res images and uploads to R2, replacing the old low-res ones.
 *
 * Usage:
 *   node scripts/upgrade-acrnm-images.mjs [--dry-run] [--model J1WTS-GT] [--limit 10]
 *
 * Prerequisites:
 *   npm install playwright @aws-sdk/client-s3
 *   npx playwright install chromium
 */

import { chromium } from 'playwright';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';
import path from 'path';

const R2_PUBLIC_URL = 'https://pub-885ce5051638470a823dcbace49705ad.r2.dev';
const SUPABASE_URL = 'https://soowdirfqjwggvijdquz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvb3dkaXJmcWp3Z2d2aWpkcXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUwNzI2MCwiZXhwIjoyMDg5MDgzMjYwfQ.4pqKaT_8gkKStYBEjlo0uWvjS4BNNdlCOv2GWVZATNw';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://be49199763861ceb41bce11aa420bcbf.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '4c6148fa442275f3f7f48e3615332d80',
    secretAccessKey: '4b4f7c9d68887b3307770ae09b32920e3135742a738051058cb74c589c8327d7',
  },
});

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const modelFilter = args.includes('--model') ? args[args.indexOf('--model') + 1] : null;
const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 0;

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
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
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
  return types[ext] || 'image/jpeg';
}

async function getR2ImageSize(key) {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: 'typotheca', Key: key }));
    return res.ContentLength || 0;
  } catch { return 0; }
}

async function main() {
  console.log(`Upgrade acrnm.com images (${dryRun ? 'DRY RUN' : 'LIVE'})`);
  if (modelFilter) console.log(`  Model filter: ${modelFilter}`);
  if (limit) console.log(`  Limit: ${limit}`);

  // Get all Acronym objects with R2 images from acrnm.com source
  let query = sb.from('objects').select('id, name, model_code, season, source_url, image_urls')
    .eq('brand', 'acronym').eq('source_site', 'acrnm.com')
    .not('image_urls', 'is', null);

  if (modelFilter) {
    query = query.ilike('name', `%${modelFilter}%`);
  }

  const { data: objects, error } = await query.order('name');
  if (error) { console.error('Query error:', error); return; }

  // Filter to objects that have R2 images (from Wayback uploads)
  const candidates = objects.filter(obj => {
    if (!obj.image_urls || obj.image_urls.length === 0) return false;
    return obj.image_urls.some(u => u.includes('r2.dev/acronym/'));
  });

  console.log(`\nFound ${candidates.length} objects with R2 images to potentially upgrade`);
  if (limit && candidates.length > limit) candidates.length = limit;

  // Build URL map: model_code + season -> acrnm.com URL
  // acrnm.com URL pattern: https://acrnm.com/{MODEL}_{SEASON}
  // e.g. https://acrnm.com/J1WTS-GT_FW2223

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  let upgraded = 0;
  let skipped = 0;
  let failed = 0;

  for (const obj of candidates) {
    const model = obj.name.replace(/^Acronym\s+/, '').trim();
    if (model.includes('Lookbook')) { skipped++; continue; }

    // Try source_url first, then construct from model + season
    let url = obj.source_url;
    if (!url || !url.includes('acrnm.com')) {
      // Construct URL: acrnm.com/{model}_{season}
      // Season format: FW22 -> FW2223, SS22 -> SS22
      const season = obj.season || '';
      if (!season || season === 'NA') { skipped++; continue; }
      url = `https://acrnm.com/${model}_${season}`;
    }

    console.log(`\n[${upgraded + skipped + failed + 1}/${candidates.length}] ${obj.name} -> ${url}`);

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for images to load
      await page.waitForTimeout(2000);

      // Extract all product image URLs from the page
      const imageUrls = await page.evaluate(() => {
        const imgs = [];
        // Try multiple selectors for product images
        const selectors = [
          'img[src*="acrnm.com"]',
          'img[src*="shopify"]',
          '.product-image img',
          '[class*="product"] img',
          '[class*="gallery"] img',
          'picture source',
          'img[srcset]',
        ];

        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(el => {
            const src = el.src || el.currentSrc;
            const srcset = el.srcset || el.getAttribute('srcset');

            if (src && src.startsWith('http') && !src.includes('data:') && !src.includes('logo') && !src.includes('icon')) {
              imgs.push(src);
            }
            if (srcset) {
              // Extract highest resolution from srcset
              const parts = srcset.split(',').map(s => s.trim().split(/\s+/));
              for (const [url] of parts) {
                if (url && url.startsWith('http')) imgs.push(url);
              }
            }
          });
        }

        // Also check for Next.js-style image containers
        document.querySelectorAll('img').forEach(el => {
          const src = el.src || el.currentSrc;
          if (src && src.startsWith('http') && !src.includes('data:') && src.includes('acrnm')) {
            imgs.push(src);
          }
        });

        return [...new Set(imgs)];
      });

      await page.close();

      if (imageUrls.length === 0) {
        console.log('  No images found on page');
        failed++;
        continue;
      }

      console.log(`  Found ${imageUrls.length} images on live site`);

      if (dryRun) {
        imageUrls.slice(0, 3).forEach(u => console.log('    ' + u.substring(0, 100)));
        upgraded++;
        continue;
      }

      // Download and upload to R2
      const newR2Urls = [];
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const imgUrl = imageUrls[i];
          const ext = imgUrl.split('?')[0].split('.').pop().toLowerCase();
          const validExt = ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg';
          const r2Key = `acronym/${model}/image-${i}.${validExt}`;

          // Check if new image is larger than existing
          const existingSize = await getR2ImageSize(r2Key);
          const buffer = await downloadImage(imgUrl);

          if (buffer.length > existingSize) {
            const r2Url = await uploadToR2(r2Key, buffer, getContentType(imgUrl));
            newR2Urls.push(r2Url);
            console.log(`  [${i}] Upgraded: ${(buffer.length / 1024).toFixed(0)}KB > ${(existingSize / 1024).toFixed(0)}KB`);
          } else {
            newR2Urls.push(`${R2_PUBLIC_URL}/${r2Key}`);
            console.log(`  [${i}] Kept existing (${(existingSize / 1024).toFixed(0)}KB >= ${(buffer.length / 1024).toFixed(0)}KB)`);
          }
        } catch (imgErr) {
          console.log(`  [${i}] Download error: ${imgErr.message}`);
        }
      }

      // Preserve any video URLs from existing image_urls
      const isVideo = u => u.endsWith('.mp4') || u.endsWith('.webm') || u.includes('vimeo.com/progressive_redirect') || (u.includes('/playback/') && u.includes('/file.mp4'));
      const existingVideos = (obj.image_urls || []).filter(isVideo);
      const finalUrls = [...newR2Urls, ...existingVideos];

      if (finalUrls.length > 0) {
        const { error: updateErr } = await sb.from('objects').update({ image_urls: finalUrls }).eq('id', obj.id);
        if (updateErr) console.log('  DB update error:', updateErr.message);
        else console.log(`  Updated: ${finalUrls.length} URLs (${newR2Urls.length} images + ${existingVideos.length} videos)`);
        upgraded++;
      }

    } catch (err) {
      console.log(`  Error: ${err.message}`);
      failed++;
    }

    // Rate limit: wait between requests to avoid blocking
    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
  }

  await browser.close();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! Upgraded: ${upgraded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(console.error);
