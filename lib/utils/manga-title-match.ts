/**
 * Guard against Consumet / scraper picking the wrong manga for an AniList id.
 */

const STOP = new Set([
  'the',
  'a',
  'an',
  'of',
  'and',
  'or',
  'to',
  'in',
  'on',
  'no',
  'wa',
  'wo',
  'ga',
  'ni',
  'manga',
  'comic',
  'manhwa',
  'manhua',
]);

export function normalizeMangaTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(title: string): string[] {
  return normalizeMangaTitle(title)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  return a.filter((t) => setB.has(t)).length;
}

function titlesSimilar(expected: string, candidate: string): boolean {
  const eNorm = normalizeMangaTitle(expected);
  const cNorm = normalizeMangaTitle(candidate);
  if (!eNorm || !cNorm) return false;

  if (eNorm === cNorm) return true;
  if (eNorm.includes(cNorm) || cNorm.includes(eNorm)) {
    // Avoid tiny substring traps ("no" in "one piece") — require enough length
    const shorter = eNorm.length <= cNorm.length ? eNorm : cNorm;
    if (shorter.length >= 6) return true;
  }

  const eTok = significantTokens(expected);
  const cTok = significantTokens(candidate);
  if (eTok.length === 0 || cTok.length === 0) return false;

  const overlap = tokenOverlap(eTok, cTok);
  const need = eTok.length <= 2 ? eTok.length : Math.min(3, Math.ceil(eTok.length * 0.6));
  return overlap >= need;
}

function consumetTitleToString(
  title: string | { romaji?: string; english?: string; native?: string } | undefined
): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.english || title.romaji || title.native || '';
}

/**
 * True if provider result plausibly matches any AniList title (or chapter slug).
 */
export function mangaProviderResultMatches(
  anilistTitles: Array<string | undefined | null>,
  providerTitle: string | { romaji?: string; english?: string; native?: string } | undefined,
  chapterIdSample?: string
): boolean {
  const expected = anilistTitles.filter((t): t is string => Boolean(t?.trim()));
  if (expected.length === 0) return true; // nothing to compare — allow

  const providerStr = consumetTitleToString(providerTitle);
  const slug = (chapterIdSample || '').split('/')[0]?.replace(/[-_]/g, ' ') || '';

  for (const exp of expected) {
    if (providerStr && titlesSimilar(exp, providerStr)) return true;
    if (slug && titlesSimilar(exp, slug)) return true;
  }

  return false;
}

export function collectAniListMangaTitles(manga: {
  title?: { romaji?: string; english?: string; native?: string };
}): string[] {
  const raw = [
    manga.title?.english,
    manga.title?.romaji,
    manga.title?.native,
  ];
  return raw.filter((t, i, arr): t is string => Boolean(t?.trim()) && arr.indexOf(t) === i);
}
