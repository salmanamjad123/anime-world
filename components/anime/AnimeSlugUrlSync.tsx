'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getAnimeDetailPath, isAniListNumericId } from '@/lib/seo/anime-path';

/**
 * When user lands on /anime/{numericId}, swap the URL to /anime/{slug}
 * via client replace (no full server redirect / reload).
 */
export function AnimeSlugUrlSync({ slug }: { slug?: string | null }) {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (!slug || slug === id || !isAniListNumericId(id)) return;

    const target = getAnimeDetailPath({ id, slug });
    if (target === `/anime/${id}`) return;

    router.replace(target, { scroll: false });
  }, [id, slug, router]);

  return null;
}
