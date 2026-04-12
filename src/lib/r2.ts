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
  if (urlOrKey.startsWith('/')) {
    return urlOrKey;
  }
  return `${R2_BASE}/${urlOrKey}`;
}

/**
 * Check if a URL points to a video file (mp4, webm, or Vimeo progressive).
 */
export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.endsWith('.mp4') || lower.endsWith('.webm') ||
    lower.includes('vimeo.com/progressive_redirect') ||
    lower.includes('/playback/') && lower.includes('/file.mp4');
}

/**
 * Get the first available image URL for an object, with fallback.
 * Skips video URLs — use getObjectVideoUrl() for those.
 */
export function getObjectImageUrl(imageUrls: string[] | null | undefined): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  // Prefer first non-video URL as thumbnail
  const firstImage = imageUrls.find(u => !isVideoUrl(u));
  if (firstImage) return resolveImageUrl(firstImage);
  // All URLs are videos — no image thumbnail
  return null;
}

/**
 * Get the first video URL for an object (for thumbnail/poster use).
 */
export function getFirstVideoUrl(imageUrls: string[] | null | undefined): string | null {
  if (!imageUrls || imageUrls.length === 0) return null;
  const first = imageUrls.find(isVideoUrl);
  return first ? resolveImageUrl(first) : null;
}

/**
 * Get all video URLs from an object's media.
 */
export function getObjectVideoUrls(imageUrls: string[] | null | undefined): string[] {
  if (!imageUrls || imageUrls.length === 0) return [];
  return imageUrls.filter(isVideoUrl).map(resolveImageUrl);
}

/**
 * Check if an object has any video media.
 */
export function hasVideo(imageUrls: string[] | null | undefined): boolean {
  if (!imageUrls) return false;
  return imageUrls.some(isVideoUrl);
}
