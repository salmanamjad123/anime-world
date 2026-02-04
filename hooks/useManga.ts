/**
 * Manga Data Hooks
 * React Query hooks for manga API
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { Manga } from '@/types';

async function fetchMangaList(
  type: string,
  page: number,
  perPage: number,
  genres?: string[],
  sort?: string
) {
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

async function fetchMangaInfo(id: string) {
  const res = await fetch(`/api/manga/${id}/info`);
  if (!res.ok) throw new Error('Failed to fetch manga');
  return res.json();
}

async function fetchMangaChapters(id: string, provider: string) {
  const res = await fetch(`/api/manga/${id}/chapters?provider=${encodeURIComponent(provider)}`);
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
  return useQuery({
    queryKey: ['manga', 'trending', page, perPage],
    queryFn: () => fetchMangaList('trending', page, perPage),
  });
}

export function usePopularManga(page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['manga', 'popular', page, perPage],
    queryFn: () => fetchMangaList('popular', page, perPage),
  });
}

export function useMangaByGenre(genres: string[], page = 1, perPage = 20, sort = 'POPULARITY_DESC') {
  return useQuery({
    queryKey: ['manga', 'genre', genres.join(','), page, perPage, sort],
    queryFn: () => fetchMangaList('popular', page, perPage, genres, sort),
    enabled: genres.length > 0,
  });
}

export function useMangaById(id: string | null, provider = 'mangapill') {
  return useQuery({
    queryKey: ['manga', 'detail', id, provider],
    queryFn: () => fetchMangaDetail(id!, provider),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

/** Manga metadata only (fast - AniList) */
export function useMangaInfo(id: string | null) {
  return useQuery({
    queryKey: ['manga', 'info', id],
    queryFn: () => fetchMangaInfo(id!),
    enabled: !!id,
  });
}

/** Chapters only (can be slow - Consumet/MangaDex) */
export function useMangaChapters(id: string | null, provider = 'mangapill') {
  return useQuery({
    queryKey: ['manga', 'chapters', id, provider],
    queryFn: () => fetchMangaChapters(id!, provider),
    enabled: !!id,
    placeholderData: keepPreviousData,
  });
}

export function useChapterPages(
  chapterId: string | null,
  provider = 'mangapill',
  options?: { refresh?: boolean }
) {
  return useQuery({
    queryKey: ['manga', 'chapter', chapterId, provider, options?.refresh],
    queryFn: () => fetchChapterPages(chapterId!, provider, options?.refresh),
    enabled: !!chapterId,
  });
}
