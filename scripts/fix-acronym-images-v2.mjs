/**
 * V2: Force-replace ALL Acronym image_urls with R2 URLs when available.
 * Replaces dead acrnm.com/content and acrnm.com/rails URLs with working R2 URLs.
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
      Bucket: 'typotheca', Prefix: 'acronym-wayback/', Delimiter: '/', MaxKeys: 1000, ContinuationToken: ct,
    }));
    for (const p of res.CommonPrefixes || []) {
      slugs.push(p.Prefix.replace('acronym-wayback/', '').replace(/\/$/, ''));
    }
    ct = res.NextContinuationToken;
  } while (ct);
  return slugs;
}

async function listImagesForSlug(slug) {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: 'typotheca', Prefix: `acronym-wayback/${slug}/image-`, MaxKeys: 100,
  }));
  return (res.Contents || []).map(c => c.Key).filter(Boolean)
    .sort((a, b) => {
      const numA = parseInt(a.match(/image-(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/image-(\d+)/)?.[1] || '0');
      return numA - numB;
    })
    .map(k => `${R2_PUBLIC_URL}/${k}`);
}

async function findObjects(slug) {
  // Match on source_url containing the slug (handles both /products/SLUG and /SLUG patterns)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/objects?source_url=like.%25${encodeURIComponent(slug)}%25&brand=eq.acronym&select=id,name,source_url,image_urls&limit=10`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return await res.json();
}

async function updateImageUrls(objectId, imageUrls) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/objects?id=eq.${objectId}`,
    {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ image_urls: imageUrls }),
    }
  );
  return res.ok;
}

async function main() {
  const slugs = await listR2Slugs();
  console.log(`Found ${slugs.length} R2 slugs`);

  let updated = 0, skipped = 0, notFound = 0, errors = 0;

  for (const slug of slugs) {
    try {
      const objects = await findObjects(slug);
      if (!objects.length) { notFound++; continue; }

      const r2Urls = await listImagesForSlug(slug);
      if (!r2Urls.length) { skipped++; continue; }

      for (const obj of objects) {
        const current = obj.image_urls || [];
        const alreadyR2 = current.length > 0 && current.every(u => u.includes('r2.dev'));

        // Skip if already fully R2 with same or more images
        if (alreadyR2 && current.length >= r2Urls.length) {
          skipped++;
          continue;
        }

        // Force replace: prefer R2 over dead CDN URLs
        const ok = await updateImageUrls(obj.id, r2Urls);
        if (ok) {
          updated++;
          if (updated % 20 === 0) console.log(`  Updated ${updated}...`);
        } else {
          errors++;
        }
      }
    } catch (err) {
      errors++;
      console.error(`  Error: ${slug}: ${err.message}`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}, Errors: ${errors}`);
}

main();
