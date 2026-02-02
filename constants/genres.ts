/**
 * Genre Constants
 * List of anime genres from AniList (matches reference filter design)
 */

export const GENRES = [
  'Action',
  'Adventure',
  'Cars',
  'Comedy',
  'Dementia',
  'Demons',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Game',
  'Harem',
  'Historical',
  'Horror',
  'Isekai',
  'Josei',
  'Kids',
  'Magic',
  'Martial Arts',
  'Mecha',
  'Military',
  'Music',
  'Mystery',
  'Parody',
  'Police',
  'Psychological',
  'Romance',
  'Samurai',
  'School',
  'Sci-Fi',
  'Seinen',
  'Shoujo',
  'Shoujo Ai',
  'Shounen',
  'Shounen Ai',
  'Slice of Life',
  'Space',
  'Sports',
  'Super Power',
  'Supernatural',
  'Thriller',
  'Vampire',
] as const;

export type Genre = (typeof GENRES)[number];

// Popular genre combinations for quick filters
export const GENRE_COLLECTIONS = {
  ACTION_PACKED: ['Action', 'Adventure'],
  ROMANCE_DRAMA: ['Romance', 'Drama'],
  SUPERNATURAL_MYSTERY: ['Supernatural', 'Mystery'],
  SCI_FI_MECHA: ['Sci-Fi', 'Mecha'],
} as const;
