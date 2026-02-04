/**
 * Manga Types
 * Shared types for manga data from AniList and Consumet
 */

export type MangaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED';
export type MangaFormat = 'MANGA' | 'NOVEL' | 'ONE_SHOT';

/**
 * Manga from AniList (for list/detail)
 */
export interface Manga {
  id: string;
  malId?: number;
  title: {
    romaji: string;
    english?: string;
    native?: string;
  };
  description?: string;
  coverImage: {
    large: string;
    medium: string;
    extraLarge?: string;
  };
  bannerImage?: string;
  genres: string[];
  averageScore?: number;
  popularity?: number;
  status?: MangaStatus;
  format?: MangaFormat;
  chapters?: number;
  volumes?: number;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  tags?: Array<{
    id: number;
    name: string;
    rank: number;
  }>;
}

/**
 * Manga chapter from Consumet
 */
export interface MangaChapter {
  id: string;
  title?: string;
  chapter?: string;
}

/**
 * Chapter page image
 */
export interface MangaChapterPage {
  img: string;
  page: number;
  headerForImage?: Record<string, string>;
}

/**
 * Manga info from Consumet meta/anilist-manga/info
 */
export interface MangaInfoConsumet {
  id: string;
  title: string | { romaji?: string; english?: string };
  malId?: number;
  image?: string;
  description?: string;
  status?: string;
  releaseDate?: number;
  startDate?: { year?: number; month?: number; day?: number };
  endDate?: { year?: number; month?: number; day?: number };
  rating?: number;
  genres?: string[];
  type?: string;
  chapters?: MangaChapter[];
}

/**
 * Manga search result from AniList
 */
export interface MangaSearchResult {
  data: {
    Page: {
      pageInfo: {
        total: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
        perPage: number;
      };
      media: Manga[];
    };
  };
}
