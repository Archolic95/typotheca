// Upload images to R2 and update Supabase for ACRONYM products
// Usage: node scripts/upload-images.mjs <JSON_ARG>
// JSON_ARG: { "product": "GGG-J2-010", "season": "FW22", "id": "...", "urls": ["https://..."] }

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://be49199763861ceb41bce11aa420bcbf.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '4c6148fa442275f3f7f48e3615332d80',
    secretAccessKey: '4b4f7c9d68887b3307770ae09b32920e3135742a738051058cb74c589c8327d7',
  },
});

const R2_PUBLIC = 'https://pub-885ce5051638470a823dcbace49705ad.r2.dev';
const BUCKET = 'typotheca';

const supabase = createClient(
  'https://soowdirfqjwggvijdquz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvb3dkaXJmcWp3Z2d2aWpkcXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUwNzI2MCwiZXhwIjoyMDg5MDgzMjYwfQ.4pqKaT_8gkKStYBEjlo0uWvjS4BNNdlCOv2GWVZATNw'
);

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'image/*,*/*',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('image')) throw new Error(`Not an image: ${ct} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 10240) throw new Error(`Too small: ${buf.length} bytes for ${url}`);
  return { buf, contentType: ct };
}

async function uploadToR2(key, buf, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buf,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${R2_PUBLIC}/${key}`;
}

async function main() {
  const arg = JSON.parse(process.argv[2]);
  const { product, season, id, urls, existingCount = 0 } = arg;

  // Slug for R2 path: lowercase, keep hyphens
  const slug = product.toLowerCase();
  const r2Dir = `acrnm/${slug}`;

  const newImageUrls = [];
  let imageNum = existingCount;

  for (const url of urls) {
    imageNum++;
    const ext = url.match(/\.(jpe?g|png|webp|gif)/i)?.[1]?.toLowerCase() || 'jpg';
    const key = `${r2Dir}/image-${imageNum}.${ext}`;

    // Check if already exists
    if (await objectExists(key)) {
      console.log(`SKIP (exists): ${key}`);
      continue;
    }

    try {
      const { buf, contentType } = await downloadImage(url);
      const publicUrl = await uploadToR2(key, buf, contentType);
      newImageUrls.push(publicUrl);
      console.log(`UPLOADED: ${key} (${(buf.length/1024).toFixed(1)}KB)`);
    } catch (e) {
      console.log(`FAIL: ${url} — ${e.message}`);
      imageNum--; // Don't increment for failed uploads
    }
  }

  if (newImageUrls.length === 0) {
    console.log('No new images uploaded');
    return;
  }

  // Get current image_urls from DB
  const { data: current } = await supabase
    .from('objects')
    .select('image_urls')
    .eq('id', id)
    .single();

  const currentUrls = current?.image_urls || [];
  const mergedUrls = [...currentUrls, ...newImageUrls];

  const { error } = await supabase
    .from('objects')
    .update({ image_urls: mergedUrls })
    .eq('id', id);

  if (error) {
    console.log(`DB ERROR: ${error.message}`);
  } else {
    console.log(`DB UPDATED: ${product} ${season} — now has ${mergedUrls.length} images`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
