/**
 * Manga Data Hooks
 * React Query hooks for manga API
 */

'use client';

import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useEffect } from 'react';
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
  pageRanges?: Array<{
    page: number;
    first: string;
    last: string;
    count: number;
    label: string;
  }>;
  firstChapter?: MangaChapter | null;
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
 * Single-page chapters for the detail UI (server-paginated).
 * Response includes `pageRanges` for the dropdown without shipping all chapters.
 */
export function useMangaChapters(
  id: string | null,
  provider = 'auto',
  mangadexId?: string | null,
  page = 1
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['manga', 'chapters', 'page', id, provider, mangadexId, page],
    queryFn: () =>
      fetchMangaChaptersPage(id!, provider, page, mangadexId ?? undefined),
    enabled: !!id,
    placeholderData: keepPreviousData,
    staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
  });

  // Prefetch adjacent pages after first success (hits server cache)
  useEffect(() => {
    if (!id || !query.data) return;
    const totalPages = Math.max(
      1,
      Math.ceil((query.data.total || 0) / (query.data.limit || CHAPTER_PAGE_SIZE))
    );
    const neighbors = [page - 1, page + 1].filter((p) => p >= 1 && p <= totalPages);
    for (const p of neighbors) {
      void queryClient.prefetchQuery({
        queryKey: ['manga', 'chapters', 'page', id, provider, mangadexId, p],
        queryFn: () =>
          fetchMangaChaptersPage(id, provider, p, mangadexId ?? undefined),
        staleTime: CACHE_DURATIONS.MANGA_LIST * 1000,
      });
    }
  }, [id, provider, mangadexId, page, query.data, queryClient]);

  return {
    ...query,
    chapters: query.data?.chapters ?? [],
    provider: query.data?.provider ?? provider,
    mode: query.data?.mode ?? provider,
    mangadexId: query.data?.mangadexId,
    source: query.data?.source,
    total: query.data?.total ?? 0,
    pageRanges: query.data?.pageRanges ?? [],
    firstChapter: query.data?.firstChapter ?? null,
    unavailableReason: query.data?.unavailableReason,
    hasMore: query.data?.hasMore ?? false,
    isFetching: query.isFetching,
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
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
    placeholderData: keepPreviousData,
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
      void queryClient
        .prefetchQuery({
          queryKey: ['manga', 'chapter', chapterId, provider],
          queryFn: () => fetchChapterPages(chapterId, provider),
          staleTime: 30 * 60 * 1000,
        })
        .then(() => {
          const cached = queryClient.getQueryData<{ pages?: Array<{ img?: string }> }>([
            'manga',
            'chapter',
            chapterId,
            provider,
          ]);
          const urls = cached?.pages?.slice(0, 4).map((p) => p.img).filter(Boolean) as string[];
          if (!urls?.length) return;
          for (const url of urls) {
            const img = new Image();
            img.decoding = 'async';
            img.src = getMangaPageImageUrl(url);
          }
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
