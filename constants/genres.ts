/**
 * Genre Constants
 * List of anime genres from AniList
 */

export const GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Horror',
  'Mahou Shoujo',
  'Mecha',
  'Music',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
] as const;

export type Genre = (typeof GENRES)[number];

// Popular genre combinations for quick filters
export const GENRE_COLLECTIONS = {
  ACTION_PACKED: ['Action', 'Adventure'],
  ROMANCE_DRAMA: ['Romance', 'Drama'],
  SUPERNATURAL_MYSTERY: ['Supernatural', 'Mystery'],
  SCI_FI_MECHA: ['Sci-Fi', 'Mecha'],
} as const;
