/**
 * One-time script to update Acronym objects in Supabase with R2 image URLs.
 *
 * For each acronym-wayback/ prefix in R2, finds the matching Supabase object
 * and updates its image_urls with the R2 public URLs.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const R2_PUBLIC_URL = 'https://pub-885ce5051638470a823dcbace49705ad.r2.dev';
const SUPABASE_URL = 'https://soowdirfqjwggvijdquz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvb3dkaXJmcWp3Z2d2aWpkcXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUwNzI2MCwiZXhwIjoyMDg5MDgzMjYwfQ.4pqKaT_8gkKStYBEjlo0uWvjS4BNNdlCOv2GWVZATNw';

const s3 = new S3Client({
  region: 'auto',
  endpoint: 'https://be49199763861ceb41bce11aa420bcbf.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '4c6148fa442275f3f7f48e3615332d80',
    secretAccessKey: '4b4f7c9d68887b3307770ae09b32920e3135742a738051058cb74c589c8327d7',
  },
});

async function listR2Slugs() {
  const slugs = [];
  let ct = undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: 'typotheca',
      Prefix: 'acronym-wayback/',
      Delimiter: '/',
      MaxKeys: 1000,
      ContinuationToken: ct,
    }));
    for (const p of res.CommonPrefixes || []) {
      const slug = p.Prefix.replace('acronym-wayback/', '').replace(/\/$/, '');
      slugs.push(slug);
    }
    ct = res.NextContinuationToken;
  } while (ct);
  return slugs;
}

async function listImagesForSlug(slug) {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: 'typotheca',
    Prefix: `acronym-wayback/${slug}/image-`,
    MaxKeys: 100,
  }));
  const keys = (res.Contents || []).map(c => c.Key).filter(Boolean).sort((a, b) => {
    // Sort image-0, image-1, ... image-10 numerically
    const numA = parseInt(a.match(/image-(\d+)/)?.[1] || '0');
    const numB = parseInt(b.match(/image-(\d+)/)?.[1] || '0');
    return numA - numB;
  });
  return keys.map(k => `${R2_PUBLIC_URL}/${k}`);
}

async function findObjectBySlug(slug) {
  // slug format: P47A-DS_SS24 -> source_url contains /P47A-DS_SS24
  const encoded = encodeURIComponent(`%${slug}%`);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/objects?source_url=like.${encoded}&brand=eq.acronym&select=id,name,source_url,image_urls&limit=5`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const data = await res.json();
  return data;
}

async function updateImageUrls(objectId, imageUrls) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/objects?id=eq.${objectId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ image_urls: imageUrls }),
    }
  );
  return res.ok;
}

async function main() {
  console.log('Listing R2 slugs...');
  const slugs = await listR2Slugs();
  console.log(`Found ${slugs.length} slugs in R2`);

  let updated = 0;
  let notFound = 0;
  let skipped = 0;
  let errors = 0;

  for (const slug of slugs) {
    try {
      const objects = await findObjectBySlug(slug);

      if (objects.length === 0) {
        notFound++;
        continue;
      }

      const r2Urls = await listImagesForSlug(slug);
      if (r2Urls.length === 0) {
        skipped++;
        continue;
      }

      for (const obj of objects) {
        // Only update if the object has fewer images or has broken ones
        const currentCount = (obj.image_urls || []).length;

        // Always prefer R2 URLs (they're reliable, CDN URLs may be expired)
        if (r2Urls.length >= currentCount || currentCount <= 1) {
          const ok = await updateImageUrls(obj.id, r2Urls);
          if (ok) {
            updated++;
            if (updated % 20 === 0) console.log(`  Updated ${updated} objects...`);
          } else {
            errors++;
            console.error(`  Failed to update ${obj.name} (${obj.id})`);
          }
        } else {
          skipped++;
        }
      }
    } catch (err) {
      errors++;
      console.error(`  Error processing ${slug}:`, err.message);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Not found in DB: ${notFound}`);
  console.log(`  Skipped (already good): ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

main();
