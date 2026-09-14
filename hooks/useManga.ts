/**
 * Manga Data Hooks
 * React Query hooks for manga API
 */

'use client';

import {
  useQuery,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import type { MangaChapter, MangaSearchResult } from '@/types';
import { CACHE_DURATIONS } from '@/constants/api';
import { getMangaPageImageUrl } from '@/lib/utils/image-url';

const CHAPTER_PAGE_SIZE = 60;

async function fetchMangaList(
  type: string,
  page: number,
  perPage: number,
  genres?: string[],
  sort?: string
): Promise<MangaSearchResult> {
  const params = new URLSearchParams({ type, page: String(page), perPage: String(perPage) });
  if (genres?.length) params.set('genres', genres.join(','));
  if (sort) params.set('sort', sort);
  const res = await fetch(`/api/manga?${params}`);
  if (!res.ok) throw new Error('Failed to fetch manga');
  return res.json();
}

async function fetchMangaDetail(id: string, provider?: string) {
  const url = provider
    ? `/api/manga/${id}?provider=${encodeURIComponent(provider)}`
    : `/api/manga/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch manga');
  return res.json();
}

async function fetchMangaInfo(id: string, mangadexId?: string) {
  const url = mangadexId
    ? `/api/manga/${id}/info?md=${encodeURIComponent(mangadexId)}`
    : `/api/manga/${id}/info`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch manga');
  return res.json();
}

export type MangaChaptersPage = {
  chapters: MangaChapter[];
  /** Resolved provider for reading */
  provider: string;
  /** Requested tab (auto, mangadex, …) */
  mode?: string;
  mangadexId?: string;
  source?: string;
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unavailableReason?: 'empty' | 'title_mismatch';
};

async function fetchMangaChaptersPage(
  id: string,
  provider: string,
  page: number,
  mangadexId?: string,
  limit = CHAPTER_PAGE_SIZE
): Promise<MangaChaptersPage> {
  const params = new URLSearchParams({
    provider,
    page: String(page),
    limit: String(limit),
  });
  if (mangadexId) params.set('md', mangadexId);
  const res = await fetch(`/api/manga/${id}/chapters?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch chapters');
  return res.json();
}

async function fetchAllMangaChapters(
  id: string,
  provider: string,
  mangadexId?: string
): Promise<MangaChaptersPage> {
  const params = new URLSearchParams({ provider, all: '1' });
  if (mangadexId) params.set('md', mangadexId);
  const res = await fetch(`/api/manga/${id}/chapters?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch chapters');
  return res.json();
}

async function fetchChapterPages(chapterId: string, provider?: string, refresh?: boolean) {
  const params = new URLSearchParams({ chapterId });
  if (provider) params.set('provider', provider);
  if (refresh) params.set('refresh', 'true');
  const res = await fetch(`/api/manga/chapter?${params}`);
  if (!res.ok) throw new Error('Failed to fetch chapter');
  return res.json();
}

export function useTrendingManga(page = 1, perPage = 20) {
  return useQuery<MangaSearchResult>({
    queryKey: ['manga', 'trending', page, perPage],
    queryFn: () => fetchMangaList('trending', page, perPage),
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });
}

export function usePopularManga(page = 1, perPage = 20) {
  return useQuery<MangaSearchResult>({
    queryKey: ['manga', 'popular', page, perPage],
    queryFn: () => fetchMangaList('popular', page, perPage),
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });
}

export function useMangaByGenre(genres: string[], page = 1, perPage = 20, sort = 'POPULARITY_DESC') {
  return useQuery<MangaSearchResult>({
    queryKey: ['manga', 'genre', genres.join(','), page, perPage, sort],
    queryFn: () => fetchMangaList('popular', page, perPage, genres, sort),
    enabled: genres.length > 0,
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });
}

export function useMangaById(id: string | null, provider = 'mangadex') {
  return useQuery({
    queryKey: ['manga', 'detail', id, provider],
    queryFn: () => fetchMangaDetail(id!, provider),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

/** Manga metadata only (fast - AniList with fallback) */
export function useMangaInfo(id: string | null, mangadexId?: string | null) {
  return useQuery({
    queryKey: ['manga', 'info', id, mangadexId],
    queryFn: () => fetchMangaInfo(id!, mangadexId ?? undefined),
    enabled: !!id,
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });
}

/**
 * Paginated chapters for the detail page (Load more).
 * Flattens pages into `chapters` for rendering.
 */
export function useMangaChapters(
  id: string | null,
  provider = 'auto',
  mangadexId?: string | null
) {
  const query = useInfiniteQuery({
    queryKey: ['manga', 'chapters', id, provider, mangadexId],
    queryFn: ({ pageParam }) =>
      fetchMangaChaptersPage(id!, provider, pageParam, mangadexId ?? undefined),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!id,
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });

  const chapters = useMemo(
    () => query.data?.pages.flatMap((p) => p.chapters) ?? [],
    [query.data]
  );

  const first = query.data?.pages[0];

  return {
    ...query,
    chapters,
    provider: first?.provider ?? provider,
    mode: first?.mode ?? provider,
    mangadexId: first?.mangadexId,
    source: first?.source,
    total: first?.total ?? chapters.length,
    hasMore: query.hasNextPage,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    data: first
      ? {
          chapters,
          provider: first.provider,
          mode: first.mode ?? provider,
          mangadexId: first.mangadexId,
          source: first.source,
          total: first.total,
          hasMore: Boolean(query.hasNextPage),
          unavailableReason: first.unavailableReason,
        }
      : undefined,
  };
}

/**
 * Full chapter list for the reader (prev/next). Uses server cache after detail warmed it.
 */
export function useMangaChaptersAll(
  id: string | null,
  provider = 'auto',
  mangadexId?: string | null
) {
  return useQuery({
    queryKey: ['manga', 'chapters', 'all', id, provider, mangadexId],
    queryFn: () => fetchAllMangaChapters(id!, provider, mangadexId ?? undefined),
    enabled: !!id,
    staleTime: 30 * 60 * 1000,
  });
}

export function useChapterPages(
  chapterId: string | null,
  provider: string | null = 'mangadex',
  options?: { refresh?: boolean }
) {
  return useQuery({
    queryKey: ['manga', 'chapter', chapterId, provider],
    queryFn: () => fetchChapterPages(chapterId!, provider!, options?.refresh),
    enabled: !!chapterId && !!provider,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/** Warm React Query cache for the next/prev chapter while the user reads */
export function usePrefetchChapterPages(
  chapterId: string | null | undefined,
  provider?: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!chapterId || !provider) return;

    const run = () => {
      void queryClient.prefetchQuery({
        queryKey: ['manga', 'chapter', chapterId, provider],
        queryFn: () => fetchChapterPages(chapterId, provider),
        staleTime: 30 * 60 * 1000,
      });
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }

    const t = window.setTimeout(run, 400);
    return () => window.clearTimeout(t);
  }, [chapterId, provider, queryClient]);
}

/** Warm browser HTTP cache for proxied page images (optional offset for page-view lookahead) */
export function usePrefetchChapterImages(
  pages: Array<{ img?: string }> | undefined,
  count = 4,
  offset = 0
) {
  const urlsKey =
    pages
      ?.slice(offset, offset + count)
      .map((p) => p.img)
      .filter(Boolean)
      .join('|') ?? '';

  useEffect(() => {
    if (!urlsKey) return;
    const urls = urlsKey.split('|');

    const start = () => {
      for (const url of urls) {
        const img = new Image();
        img.decoding = 'async';
        img.src = getMangaPageImageUrl(url);
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(start, { timeout: 1500 });
      return () => cancelIdleCallback(id);
    }

    const t = window.setTimeout(start, 50);
    return () => window.clearTimeout(t);
  }, [urlsKey]);
}
