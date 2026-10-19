import type { NextConfig } from "next";

/**
 * When true, next/image skips Vercel Image Optimization and serves the
 * original src (plain <img>). Avoids blank images after the monthly
 * optimization quota is exceeded. Set NEXT_PUBLIC_IMAGES_UNOPTIMIZED=false
 * to turn optimization back on (e.g. after upgrading the Vercel plan).
 */
const imagesUnoptimized =
  process.env.NEXT_PUBLIC_IMAGES_UNOPTIMIZED !== "false";

const nextConfig: NextConfig = {
  async headers() {
    const catalog = "public, s-maxage=120, stale-while-revalidate=600";
    const catalogHeaders = [
      { key: "Cache-Control", value: catalog },
      { key: "CDN-Cache-Control", value: catalog },
      { key: "Vercel-CDN-Cache-Control", value: catalog },
      { key: "Cloudflare-CDN-Cache-Control", value: catalog },
    ];
    const htmlCdn = "public, s-maxage=60, stale-while-revalidate=300";
    const htmlHeaders = [
      { key: "CDN-Cache-Control", value: htmlCdn },
      { key: "Cloudflare-CDN-Cache-Control", value: htmlCdn },
    ];
    // Watch shell is anonymous client HTML — Cache-Control public so CF Eligible
    // even if the Cache Rule does not ignore origin TTL.
    const watchHeaders = [
      { key: "Cache-Control", value: htmlCdn },
      { key: "CDN-Cache-Control", value: htmlCdn },
      { key: "Vercel-CDN-Cache-Control", value: htmlCdn },
      { key: "Cloudflare-CDN-Cache-Control", value: htmlCdn },
    ];
    const streamCdn = "public, s-maxage=60, stale-while-revalidate=180";
    const streamHeaders = [
      { key: "Cache-Control", value: streamCdn },
      { key: "CDN-Cache-Control", value: streamCdn },
      { key: "Vercel-CDN-Cache-Control", value: streamCdn },
      { key: "Cloudflare-CDN-Cache-Control", value: streamCdn },
    ];
    const redirectCdn = "public, s-maxage=86400, stale-while-revalidate=604800";
    const redirectHeaders = [
      { key: "Cache-Control", value: redirectCdn },
      { key: "CDN-Cache-Control", value: redirectCdn },
      { key: "Vercel-CDN-Cache-Control", value: redirectCdn },
      { key: "Cloudflare-CDN-Cache-Control", value: redirectCdn },
    ];
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      { source: "/", headers: htmlHeaders },
      { source: "/anime/:path*", headers: htmlHeaders },
      { source: "/manga/:path*", headers: htmlHeaders },
      { source: "/watch/:path*", headers: watchHeaders },
      { source: "/api/anime", headers: catalogHeaders },
      { source: "/api/anime/:path*", headers: catalogHeaders },
      { source: "/api/manga", headers: catalogHeaders },
      { source: "/api/manga/:id", headers: catalogHeaders },
      { source: "/api/manga/:id/info", headers: catalogHeaders },
      {
        source: "/api/manga/:id/chapters",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/manga/chapter",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
          { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/azlist/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
        ],
      },
      { source: "/api/search/:path*", headers: catalogHeaders },
      { source: "/api/search", headers: catalogHeaders },
      {
        source: "/api/episodes/:path*",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/api/schedule",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Cloudflare-CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
      { source: "/api/stream/:path*", headers: streamHeaders },
      { source: "/api/proxy", headers: redirectHeaders },
      { source: "/api/image", headers: redirectHeaders },
      { source: "/api/subtitles", headers: redirectHeaders },
      { source: "/api/subtitles/:path*", headers: redirectHeaders },
    ];
  },
  images: {
    // Global: all next/image usages — no per-component changes needed
    unoptimized: imagesUnoptimized,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's4.anilist.co',
        pathname: '/file/anilistcdn/**',
      },
      {
        protocol: 'https',
        hostname: 'artworks.thetvdb.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gogocdn.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.kitsu.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hianime.to',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.noitatnemucod.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.anipixcdn.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'uploads.mangadex.org',
        pathname: '/covers/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'anime-world-proxy.animevillage-proxy.workers.dev',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
