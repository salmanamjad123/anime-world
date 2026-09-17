/**
 * Guard against Consumet / scraper picking the wrong manga for an AniList id.
 *
 * Consumet meta/anilist-manga often returns the *AniList* title even when the
 * scraper mapped a sequel or a light novel (e.g. Solo Leveling manhwa →
 * solo-leveling-novel / solo_leveling_ragnarok). Chapter id / slug is the real
 * signal — always validate it when readable.
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
  'webtoon',
  'web',
]);

/** Harmless extras (editions / numbering) — not treated as a different series */
const GENERIC_EXTRA = new Set([
  'season',
  'part',
  'volume',
  'vol',
  'chapter',
  'ch',
  'episode',
  'ep',
  'official',
  'colored',
  'colour',
  'color',
  'full',
  'version',
  'ver',
  'edition',
  'book',
  'comic',
  'webtoon',
]);

/**
 * If these appear in the candidate but not in the expected title, treat as a
 * different work (sequel / spin-off / remake).
 */
const SEQUEL_MARKERS = new Set([
  'ragnarok',
  'ragnarök',
  'sequel',
  'gaiden',
  'spinoff',
  'spin',
  'side',
  'another',
  'remake',
  'reboot',
  'returns',
  'return',
  'again',
  'zero',
  'origins',
  'origin',
  'prologue',
  'epilogue',
  'after',
  'before',
  'next',
  'generation',
  'chronicle',
  'chronicles',
  'legend',
  'legends',
  'ex',
  'plus',
  'extra',
  'specials',
  'special',
]);

/**
 * Format markers: manhwa pages must not resolve to light-novel / text editions.
 * Reject when candidate has these and expected does not.
 */
const NOVEL_FORMAT_MARKERS = new Set([
  'novel',
  'novels',
  'lightnovel',
  'lightnovels',
  'webnovel',
  'webnovels',
  'prose',
  'ebook',
]);

export function normalizeMangaTitle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    // glue "light-novel" / "lightnovel" into one token-friendly form
    .replace(/light\s*novel/g, ' lightnovel ')
    .replace(/web\s*novel/g, ' webnovel ')
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

function hasNovelFormatMarker(text: string): boolean {
  const norm = normalizeMangaTitle(text);
  if (!norm) return false;
  if (NOVEL_FORMAT_MARKERS.has(norm)) return true;
  const tokens = norm.split(' ');
  if (tokens.some((t) => NOVEL_FORMAT_MARKERS.has(t))) return true;
  // raw path checks (before stop-word stripping)
  return /(?:^|[^a-z])(?:light[\s_-]*novel|web[\s_-]*novel|novel)(?:[^a-z]|$)/i.test(
    text
  );
}

/** True when expected titles look like a novel (AniList NOVEL / title contains novel). */
export function expectedIsNovel(
  expectedTitles: Array<string | undefined | null>,
  format?: string | null
): boolean {
  if (format && String(format).toUpperCase() === 'NOVEL') return true;
  return expectedTitles.some((t) => t && hasNovelFormatMarker(t));
}

/**
 * Reject light-novel / text editions when the user is browsing manga/manhwa.
 */
export function isDisallowedNovelEdition(
  candidate: string,
  expectedTitles: Array<string | undefined | null>,
  format?: string | null
): boolean {
  if (!hasNovelFormatMarker(candidate)) return false;
  // Allow when the AniList entry itself is a novel
  if (expectedIsNovel(expectedTitles, format)) return false;
  return true;
}

/**
 * True when candidate is the same work as expected — not a sequel/spin-off/novel.
 * "Solo Leveling" must NOT match "Solo Leveling Ragnarok" or "Solo Leveling Novel".
 */
export function titlesSimilar(expected: string, candidate: string): boolean {
  const eNorm = normalizeMangaTitle(expected);
  const cNorm = normalizeMangaTitle(candidate);
  if (!eNorm || !cNorm) return false;

  if (eNorm === cNorm) return true;

  // Novel vs comics: reject unless expected is also a novel
  if (hasNovelFormatMarker(candidate) && !hasNovelFormatMarker(expected)) {
    return false;
  }

  const eTok = significantTokens(expected);
  const cTok = significantTokens(candidate);
  if (eTok.length === 0 || cTok.length === 0) return false;

  const eSet = new Set(eTok);
  const extras = cTok.filter((t) => !eSet.has(t));
  const meaningfulExtras = extras.filter(
    (t) =>
      !GENERIC_EXTRA.has(t) &&
      !/^\d+$/.test(t) &&
      !NOVEL_FORMAT_MARKERS.has(t) // already handled above; keep out of "extra identity"
  );

  // Sequel / spin-off markers in candidate only → reject
  if (extras.some((t) => SEQUEL_MARKERS.has(t))) {
    return false;
  }
  // Novel markers slipped into tokens
  if (extras.some((t) => NOVEL_FORMAT_MARKERS.has(t)) && !eTok.some((t) => NOVEL_FORMAT_MARKERS.has(t))) {
    return false;
  }

  // Any meaningful extra identity token → different work
  if (meaningfulExtras.length > 0) {
    return false;
  }

  // Candidate is equal or a shortening of expected
  if (eNorm.includes(cNorm) && cNorm.length >= 6) {
    return true;
  }

  if (cNorm.includes(eNorm) && eNorm.length >= 6) {
    return true;
  }

  const overlap = tokenOverlap(eTok, cTok);
  const need = eTok.length <= 2 ? eTok.length : Math.min(3, Math.ceil(eTok.length * 0.6));
  const missing = eTok.filter((t) => !cTok.includes(t));
  if (missing.length > Math.max(0, eTok.length - need)) return false;
  return overlap >= need && meaningfulExtras.length === 0;
}

function consumetTitleToString(
  title: string | { romaji?: string; english?: string; native?: string } | undefined
): string {
  if (!title) return '';
  if (typeof title === 'string') return title;
  return title.english || title.romaji || title.native || '';
}

/** Human-readable scraper slug fragments (not bare UUIDs / numeric ids). */
function usableSlugParts(raw: string): string[] {
  const parts = String(raw || '')
    .split(/[/?#]/)
    .map((p) => p.replace(/[-_]/g, ' ').trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const part of parts) {
    const compact = part.replace(/\s/g, '');
    if (/^[0-9a-f]{8}\s+[0-9a-f]{4}\s+/i.test(part)) continue;
    if (/^[0-9a-f-]{16,}$/i.test(compact)) continue;
    if (/^[\d\s]+$/.test(part)) continue;
    if (!/[a-z]/i.test(part)) continue;
    out.push(part);
  }

  if (out.length > 1) {
    out.push(out.join(' '));
  }
  // Always include raw-ish joined form for novel detection on full path
  const joined = parts.join(' ');
  if (joined && !out.includes(joined)) out.push(joined);
  return out;
}

function chapterSamples(
  chapterIdSample?: string | string[] | null
): string[] {
  if (!chapterIdSample) return [];
  const ids = Array.isArray(chapterIdSample) ? chapterIdSample : [chapterIdSample];
  const slugs: string[] = [];
  for (const id of ids) {
    for (const part of usableSlugParts(String(id || ''))) {
      slugs.push(part);
    }
  }
  return slugs;
}

export type MangaMatchOptions = {
  /** AniList format (MANGA / NOVEL / ONE_SHOT). Used to allow novel matches only for novels. */
  format?: string | null;
};

/**
 * True if provider result plausibly matches any AniList title.
 * When chapter ids have readable slugs, those must match (meta title alone is not enough).
 * Light-novel editions are rejected for manga/manhwa entries.
 */
export function mangaProviderResultMatches(
  anilistTitles: Array<string | undefined | null>,
  providerTitle: string | { romaji?: string; english?: string; native?: string } | undefined,
  chapterIdSample?: string | string[] | null,
  options?: MangaMatchOptions
): boolean {
  const expected = anilistTitles.filter((t): t is string => Boolean(t?.trim()));
  if (expected.length === 0) return true;

  const format = options?.format;
  const providerStr = consumetTitleToString(providerTitle);
  const slugs = chapterSamples(chapterIdSample);

  // Block novel/text editions when browsing comics
  if (providerStr && isDisallowedNovelEdition(providerStr, expected, format)) {
    return false;
  }
  if (slugs.some((s) => isDisallowedNovelEdition(s, expected, format))) {
    return false;
  }
  if (
    Array.isArray(chapterIdSample)
      ? chapterIdSample.some((id) => isDisallowedNovelEdition(String(id), expected, format))
      : chapterIdSample &&
        isDisallowedNovelEdition(String(chapterIdSample), expected, format)
  ) {
    return false;
  }

  // Ground truth: scraper chapter path
  if (slugs.length > 0) {
    return slugs.some((slug) =>
      expected.some((exp) => titlesSimilar(exp, slug))
    );
  }

  if (!providerStr) return true;
  return expected.some((exp) => titlesSimilar(exp, providerStr));
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
