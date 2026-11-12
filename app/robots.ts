import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';

/** Arena-only: do not invite crawlers onto dead anime/manga paths. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/anime/',
          '/manga/',
          '/watch/',
          '/search/',
          '/genre/',
          '/history/',
          '/watchlist/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
