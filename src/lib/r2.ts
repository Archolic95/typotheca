const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '';

// Hostnames whitelisted in next.config.ts remotePatterns
const OPTIMIZED_HOSTS = new Set([
  'r2.dev', 'cloudflarestorage.com', 'acrnm.com',
  'images.arcteryx.com', 'shopify.com', 'web.archive.org',
  'image-raw.reversible.com', 'image.reversible.com',
  'media-assets.grailed.com', 'stoneisland.com', 'arcteryx.com',
  'cloudfront.net', 'imgix.net',
]);

/**
 * Check if a URL's host is whitelisted for Next.js Image optimization.
 */
export function isOptimizableUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return [...OPTIMIZED_HOSTS].some(h => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * Resolve an image URL. If it's already a full URL (http/https), return as-is.
 * If it's an R2 key, prepend the public bucket URL.
 */
export function resolveImageUrl(urlOrKey: string): string {
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey;
  }
  return `${R2_BASE}/${urlOrKey}`;
}

/**
 * Get the first available image URL for an object, with fallback.
 */
export function getObjectImageUrl(imageUrls: string[] | null | undefined): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  return resolveImageUrl(imageUrls[0]);
}
