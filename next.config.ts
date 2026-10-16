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
      {
        source: "/api/anime",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/api/manga",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=120, stale-while-revalidate=600" },
        ],
      },
      {
        source: "/api/schedule",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
          { key: "Vercel-CDN-Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
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
