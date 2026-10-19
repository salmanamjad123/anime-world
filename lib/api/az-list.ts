/**
 * Footer A–Z lists. Never wait on Railway /azlist (Cloudflare 504s).
 * AniList first (same ids as the rest of the site), then Jikan, then popular.
 */

import { axiosInstance } from './axios';
import { ANILIST_API_URL } from '@/constants/api';
import { getPopularAnime } from './anilist';
import { getJikanAZList } from './jikan';
import { WATCHABLE_CATALOG_STATUSES } from './watchable-catalog';
import type { Anime } from '@/types';
import type { HiAnimeAZItem, HiAnimeAZListResponse } from './hianime';

const SEARCH_QUERY = `
  query ($search: String, $page: Int, $perPage: Int, $sort: [MediaSort], $status_in: [MediaStatus]) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { total currentPage lastPage hasNextPage perPage }
      media(type: ANIME, search: $search, sort: $sort, status_in: $status_in) {
        id
        title { romaji english }
        coverImage { large medium }
        format
        averageScore
        episodes
      }
    }
  }
`;

function firstTitle(anime: Pick<Anime, 'title'> | { title?: { romaji?: string; english?: string } }) {
  return (anime.title?.english || anime.title?.romaji || '').trim();
}

function matchesLetter(title: string, letter: string) {
  const t = title.toLowerCase();
  if (!t) return false;
  if (letter === '0-9') return /^\d/.test(t);
  if (letter === 'all' || letter === 'other') return true;
  return t.startsWith(letter);
}

function matchesLetterAnime(
  anime: Pick<Anime, 'title'> | { title?: { romaji?: string; english?: string } },
  letter: string
) {
  const english = anime.title?.english?.trim() || '';
  const romaji = anime.title?.romaji?.trim() || '';
  return matchesLetter(english, letter) || matchesLetter(romaji, letter);
}

function toAzItem(anime: Anime): HiAnimeAZItem {
  const name = firstTitle(anime) || 'Unknown';
  const poster = anime.coverImage?.large || anime.coverImage?.medium || '';
  return {
    id: String(anime.id),
    name,
    poster,
    type: anime.format || null,
    rating: anime.averageScore != null ? String(anime.averageScore / 10) : null,
    episodes: { sub: anime.episodes ?? null, dub: null },
  };
}

const ANILIST_MAL_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(type: ANIME, idMal_in: $ids) {
        id
        idMal
        title { romaji english }
        coverImage { large medium }
        format
        averageScore
        episodes
      }
    }
  }
`;

async function remapJikanAzToAnilist(
  list: HiAnimeAZListResponse
): Promise<HiAnimeAZListResponse> {
  const malIds = list.animes
    .map((item) => (item.id ? parseInt(item.id, 10) : NaN))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (malIds.length === 0) return list;

  try {
    const res = await axiosInstance.post<{
      data?: { Page?: { media?: Array<Anime & { idMal?: number }> } };
    }>(
      ANILIST_API_URL,
      { query: ANILIST_MAL_QUERY, variables: { ids: malIds } },
      { timeout: 4000 }
    );
    const media = res.data?.data?.Page?.media ?? [];
    const byMal = new Map(media.map((item) => [String(item.idMal), item]));
    return {
      ...list,
      animes: list.animes.map((item) => {
        const mapped = item.id ? byMal.get(item.id) : undefined;
        return mapped ? toAzItem(mapped) : item;
      }),
    };
  } catch {
    return list;
  }
}

async function anilistByLetter(letter: string, page: number): Promise<HiAnimeAZListResponse | null> {
  const isAll = letter === 'all' || letter === 'other';
  const variables: Record<string, unknown> = {
    page,
    perPage: 50,
    sort: isAll ? ['POPULARITY_DESC'] : ['TITLE_ROMAJI'],
    status_in: WATCHABLE_CATALOG_STATUSES,
  };
  if (!isAll) variables.search = letter === '0-9' ? '0' : letter;

  const res = await axiosInstance.post<{
    data?: { Page?: { pageInfo?: { lastPage?: number; hasNextPage?: boolean }; media?: Anime[] } };
  }>(ANILIST_API_URL, { query: SEARCH_QUERY, variables }, { timeout: 4500 });

  const pageData = res.data?.data?.Page;
  const media = pageData?.media ?? [];
  const matched = isAll ? media : media.filter((m) => matchesLetterAnime(m, letter));
  if (matched.length === 0) return null;

  return {
    sortOption: letter,
    animes: matched.map(toAzItem),
    totalPages: pageData?.pageInfo?.lastPage ?? 1,
    hasNextPage: pageData?.pageInfo?.hasNextPage ?? false,
    currentPage: page,
  };
}

async function popularAsAz(letter: string, page: number): Promise<HiAnimeAZListResponse> {
  const popular = await getPopularAnime(page, 30);
  const media = popular.data?.Page?.media ?? [];
  return {
    sortOption: letter,
    animes: media.map(toAzItem),
    totalPages: popular.data?.Page?.pageInfo?.lastPage ?? 1,
    hasNextPage: popular.data?.Page?.pageInfo?.hasNextPage ?? false,
    currentPage: page,
  };
}

/** Always returns a list (may be popular titles if letter sources fail). */
export async function getAzListForLetter(
  sortOption: string,
  page = 1
): Promise<HiAnimeAZListResponse> {
  const letter = decodeURIComponent(sortOption || 'a').toLowerCase();
  const valid = [
    'all', 'other', '0-9',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  ];
  const key = valid.includes(letter) ? letter : 'a';
  const useJikanLetter = key !== 'all' && key !== 'other';

  if (useJikanLetter) {
    try {
      const fromJikan = await getJikanAZList(key, page);
      if (fromJikan.animes.length > 0) return remapJikanAzToAnilist(fromJikan);
    } catch (err) {
      console.warn('[AZ] Jikan letter browse failed:', (err as Error).message);
    }
  }

  try {
    const fromAnilist = await anilistByLetter(key, page);
    if (fromAnilist?.animes.length) return fromAnilist;
  } catch (err) {
    console.warn('[AZ] AniList letter browse failed:', (err as Error).message);
  }

  try {
    return await popularAsAz(key, page);
  } catch (err) {
    console.warn('[AZ] Popular fallback failed:', (err as Error).message);
    return {
      sortOption: key,
      animes: [],
      totalPages: 1,
      hasNextPage: false,
      currentPage: page,
    };
  }
}
