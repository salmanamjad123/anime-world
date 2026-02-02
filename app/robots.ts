/**
 * Dynamic robots.txt for SEO
 * Allows crawling and references sitemap
 */

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/watch/'], // Don't index API routes or watch pages (ephemeral)
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/watch/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
