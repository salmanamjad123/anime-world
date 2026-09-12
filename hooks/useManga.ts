/**
 * Manga Data Hooks
 * React Query hooks for manga API
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Manga, MangaSearchResult } from '@/types';
import { CACHE_DURATIONS } from '@/constants/api';

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

async function fetchMangaChapters(id: string, provider: string, mangadexId?: string) {
  const params = new URLSearchParams({ provider });
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

/** Chapters only (MangaDex readable first → Consumet) */
export function useMangaChapters(id: string | null, provider = 'mangadex', mangadexId?: string | null) {
  return useQuery({
    queryKey: ['manga', 'chapters', id, provider, mangadexId],
    queryFn: () => fetchMangaChapters(id!, provider, mangadexId ?? undefined),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useChapterPages(
  chapterId: string | null,
  provider = 'mangadex',
  options?: { refresh?: boolean }
) {
  return useQuery({
    queryKey: ['manga', 'chapter', chapterId, provider, options?.refresh],
    queryFn: () => fetchChapterPages(chapterId!, provider, options?.refresh),
    enabled: !!chapterId,
  });
}
