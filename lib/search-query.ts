/**
 * Typeahead query helpers: "shangrila" should still hit "Shangri-La Frontier".
 */

export function compactSearchText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function expandSearchQueries(raw: string): string[] {
  const q = raw.trim();
  if (!q) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string) => {
    const next = value.trim().replace(/\s+/g, ' ');
    if (!next) return;
    const key = next.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(next);
  };

  add(q);
  add(q.replace(/[-_]+/g, ' '));
  add(q.replace(/([a-z])([A-Z])/g, '$1 $2'));

  const compact = compactSearchText(q);
  const isOneToken = !/[\s-]/.test(q);
  if (isOneToken && compact.length >= 6) {
    const particles = ['la', 'no', 'wo', 'to', 'ga', 'ni', 'de', 'kai', 'sen', 'chan', 'kun', 'sama', 'man'];
    for (const particle of particles) {
      if (!compact.endsWith(particle) || compact.length <= particle.length + 3) continue;
      const head = compact.slice(0, -particle.length);
      add(`${head} ${particle}`);
      add(`${head}-${particle}`);
    }
    const prefixLen = Math.min(7, compact.length - 1);
    if (prefixLen >= 5) add(compact.slice(0, prefixLen));
  }

  const primary = out[0];
  const compactPrimary = compactSearchText(primary);
  const sameLetters = out.find(
    (variant) => variant !== primary && compactSearchText(variant) === compactPrimary
  );
  const prefix = out.find(
    (variant) => compactSearchText(variant) !== compactPrimary
  );

  return [primary, sameLetters, prefix].filter((value, index, list): value is string => {
    return Boolean(value) && list.indexOf(value) === index;
  });
}

export function titleMatchesCompactQuery(
  title: { english?: string | null; romaji?: string | null; native?: string | null },
  query: string,
  synonyms?: string[]
): boolean {
  const compactQuery = compactSearchText(query);
  if (compactQuery.length < 3) return false;
  const hay = compactSearchText(
    [title.english, title.romaji, title.native, ...(synonyms ?? [])].filter(Boolean).join(' ')
  );
  return hay.includes(compactQuery);
}
