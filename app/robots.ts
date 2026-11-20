/**
 * Dynamic robots.txt for SEO
 * Allows crawling and references sitemap
 */

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/constants/site';

export default function robots(): MetadataRoute.Robots {
  const disallow = [
    '/api/',
    '/watch/', // ephemeral episode URLs — index /anime/{id} instead
    '/admin/',
    '/watchlist',
    '/history',
    '/manga/profile',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
