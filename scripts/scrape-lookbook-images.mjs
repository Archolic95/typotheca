/**
 * Scrape lookbook images from Highsnobiety articles.
 *
 * Uses Playwright to render the full article pages and extract all product images.
 * Updates the corresponding lookbook objects in Supabase with the scraped image URLs,
 * after uploading them to R2.
 *
 * Usage:
 *   node scripts/scrape-lookbook-images.mjs [--dry-run] [--season FW21]
 */

import { chromium } from 'playwright';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';

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
const seasonFilter = args.includes('--season') ? args[args.indexOf('--season') + 1] : null;

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } }, (res) => {
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

async function main() {
  console.log(`Scrape lookbook images (${dryRun ? 'DRY RUN' : 'LIVE'})`);

  // Get all lookbook objects with source URLs
  let query = sb.from('objects').select('id, name, season, source_url, image_urls')
    .eq('brand', 'acronym')
    .ilike('name', '%Lookbook%')
    .not('source_url', 'is', null);

  if (seasonFilter) {
    query = query.eq('season', seasonFilter);
  }

  const { data: lookbooks, error } = await query.order('season');
  if (error) { console.error('Query error:', error); return; }

  console.log(`Found ${lookbooks.length} lookbook(s) with source URLs\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  for (const lb of lookbooks) {
    console.log(`\n=== ${lb.name} (${lb.season}) ===`);
    console.log(`  Source: ${lb.source_url}`);

    const existingImages = (lb.image_urls || []).filter(u =>
      !u.endsWith('.mp4') && !u.endsWith('.webm') && !u.includes('vimeo.com') && !u.includes('/file.mp4')
    );
    const existingVideos = (lb.image_urls || []).filter(u =>
      u.endsWith('.mp4') || u.endsWith('.webm') || u.includes('vimeo.com') || u.includes('/file.mp4')
    );

    console.log(`  Current: ${existingImages.length} images, ${existingVideos.length} videos`);

    try {
      const page = await context.newPage();
      await page.goto(lb.source_url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for lazy-loaded images
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);

      // Scroll gradually to trigger all lazy-loading
      const height = await page.evaluate(() => document.body.scrollHeight);
      for (let y = 0; y < height; y += 500) {
        await page.evaluate(scrollY => window.scrollTo(0, scrollY), y);
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(2000);

      // Extract article content images only (not sidebar/related/shop)
      // Strategy: find the article slug from URL and match images with that slug
      const articleSlug = lb.source_url.split('/p/')[1]?.replace(/\/$/, '') || '';
      const imageUrls = await page.evaluate((slug) => {
        const imgs = new Set();

        // Get all images on the page
        document.querySelectorAll('img').forEach(el => {
          const src = el.src || el.currentSrc;
          if (!src || !src.startsWith('http') || src.includes('data:')) return;
          imgs.add(src);
        });

        const allUrls = [...imgs];

        // Filter: keep only images whose filename contains the article slug
        // e.g. "acronym-aw21-collection-highsnobiety-shop" matches
        // "acronym-aw21-collection-highsnobiety-shop-01.jpg"
        if (slug) {
          const slugParts = slug.split('-');
          // Match images that share significant slug words (at least 3 words)
          const relevant = allUrls.filter(url => {
            const filename = url.split('/').pop().split('?')[0].toLowerCase();
            const matches = slugParts.filter(p => p.length > 2 && filename.includes(p));
            return matches.length >= 3;
          });
          if (relevant.length > 0) return relevant;
        }

        // Fallback: return images from article body only
        const article = document.querySelector('article') || document.querySelector('[class*="article-body"]') || document.querySelector('[class*="post-content"]');
        if (article) {
          const bodyImgs = [];
          article.querySelectorAll('img').forEach(el => {
            const src = el.src || el.currentSrc;
            if (src && src.startsWith('http') && !src.includes('data:') &&
                !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
              bodyImgs.push(src);
            }
          });
          if (bodyImgs.length > 0) return bodyImgs;
        }

        return allUrls;
      }, articleSlug);

      await page.close();

      // Filter and upgrade to high-res
      const uniqueUrls = [...new Set(imageUrls)].filter(u => {
        if (u.includes('w=50') || u.includes('w=100') || u.includes('h=50')) return false;
        if (u.includes('data:image')) return false;
        return true;
      }).map(u => {
        // For Highsnobiety/dato images, request higher resolution
        if (u.includes('highsnobiety.com/static-assets/dato/')) {
          const base = u.split('?')[0];
          return base + '?w=2000&auto=format&cs=srgb';
        }
        return u;
      });

      // Prefer highest resolution version of each image
      const deduped = [];
      const seen = new Set();
      for (const url of uniqueUrls) {
        // Normalize by removing size params to deduplicate
        const base = url.split('?')[0].replace(/\/\d+x\d+\//, '/');
        if (!seen.has(base)) {
          seen.add(base);
          deduped.push(url);
        }
      }

      console.log(`  Found ${deduped.length} images on page`);

      if (deduped.length === 0) {
        console.log('  No images found, skipping');
        continue;
      }

      if (dryRun) {
        deduped.forEach((u, i) => console.log(`  [${i}] ${u.substring(0, 120)}`));
        continue;
      }

      // Download and upload to R2
      const slug = lb.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const r2Urls = [];

      for (let i = 0; i < deduped.length; i++) {
        try {
          const imgUrl = deduped[i];
          const ext = imgUrl.split('?')[0].split('.').pop().toLowerCase();
          const validExt = ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext) ? ext : 'jpg';
          const r2Key = `acronym-lookbook/${slug}/image-${i}.${validExt}`;

          const buffer = await downloadImage(imgUrl);

          // Skip tiny images (< 10KB likely thumbnails or icons)
          if (buffer.length < 10000) {
            console.log(`  [${i}] Skipped (${(buffer.length / 1024).toFixed(0)}KB too small)`);
            continue;
          }

          const r2Url = await uploadToR2(r2Key, buffer, getContentType(imgUrl));
          r2Urls.push(r2Url);
          console.log(`  [${i}] Uploaded: ${(buffer.length / 1024).toFixed(0)}KB -> ${r2Key}`);
        } catch (imgErr) {
          console.log(`  [${i}] Download error: ${imgErr.message}`);
        }
      }

      // Combine new images with existing videos
      const finalUrls = [...r2Urls, ...existingVideos];

      if (r2Urls.length > 0) {
        const { error: updateErr } = await sb.from('objects').update({ image_urls: finalUrls }).eq('id', lb.id);
        if (updateErr) console.log('  DB update error:', updateErr.message);
        else console.log(`  Updated: ${r2Urls.length} images + ${existingVideos.length} videos`);
      }

    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 3000));
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
