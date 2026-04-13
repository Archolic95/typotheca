import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Next.js image optimization: auto WebP/AVIF, responsive srcset, lazy loading
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
      { protocol: 'https', hostname: 'acrnm.com' },
      { protocol: 'https', hostname: '**.acrnm.com' },
      { protocol: 'https', hostname: 'images.arcteryx.com' },
      { protocol: 'https', hostname: '**.shopify.com' },
      { protocol: 'http', hostname: '**.shopify.com' },
      { protocol: 'https', hostname: 'web.archive.org' },
      // Reversible CDN
      { protocol: 'https', hostname: 'image-raw.reversible.com' },
      { protocol: 'https', hostname: 'image.reversible.com' },
      // Grailed
      { protocol: 'https', hostname: 'media-assets.grailed.com' },
      // Stone Island (Wayback)
      { protocol: 'https', hostname: '**.stoneisland.com' },
      // Arc'teryx Outlet/Resale
      { protocol: 'https', hostname: '**.arcteryx.com' },
      // Generic CDNs
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: '**.imgix.net' },
    ],
    // Limit generated sizes for performance
    deviceSizes: [640, 828, 1080, 1200],
    imageSizes: [128, 256, 384],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
