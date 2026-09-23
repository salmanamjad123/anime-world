/**
 * Adsterra placement catalog — single source for admin UI and visibility checks.
 */

export const AD_PLACEMENTS = [
  {
    id: 'home_trending_320',
    label: 'Trending Now strip',
    page: 'Home',
    path: '/',
    format: '320×50',
    units: 1,
  },
  {
    id: 'home_grid_300',
    label: 'Trending grid cards',
    page: 'Home',
    path: '/',
    format: '300×250',
    units: 2,
  },
  {
    id: 'watch_player',
    label: 'Under video player',
    page: 'Watch',
    path: '/watch/…',
    format: '300×250 / native',
    units: 1,
  },
  {
    id: 'home_smartlink',
    label: 'Home click smartlink (3rd click / session)',
    page: 'Home',
    path: '/',
    format: 'Smartlink (new tab)',
    units: 1,
  },
  {
    id: 'manga_synopsis_320',
    label: 'Above synopsis',
    page: 'Manga detail',
    path: '/manga/[id]',
    format: '320×50',
    units: 1,
  },
  {
    id: 'anime_synopsis_320',
    label: 'Above synopsis',
    page: 'Anime detail',
    path: '/anime/[id]',
    format: '320×50',
    units: 1,
  },
  {
    id: 'manga_trending_grid_160',
    label: 'Trending grid card',
    page: 'Manga home',
    path: '/manga',
    format: '160×300',
    units: 1,
  },
] as const;

export type AdPlacementId = (typeof AD_PLACEMENTS)[number]['id'];

export type AdPlacementsMap = Record<AdPlacementId, boolean>;

export const AD_PLACEMENT_IDS: AdPlacementId[] = AD_PLACEMENTS.map((p) => p.id);

export function defaultAdPlacements(): AdPlacementsMap {
  return Object.fromEntries(
    AD_PLACEMENT_IDS.map((id) => [id, true])
  ) as AdPlacementsMap;
}

export function normalizeAdPlacements(
  raw: Partial<Record<string, unknown>> | null | undefined
): AdPlacementsMap {
  const base = defaultAdPlacements();
  if (!raw || typeof raw !== 'object') return base;
  for (const id of AD_PLACEMENT_IDS) {
    if (raw[id] === false) base[id] = false;
  }
  return base;
}

export type AdAudienceContext = {
  isLoggedIn: boolean;
  userAdsHidden: boolean;
};

export type AdPolicySettings = {
  enabled: boolean;
  hideForLoggedInUsers: boolean;
  /** Guest home line: “Log in to watch ad-free”. */
  showAdFreeLoginBanner: boolean;
  placements: AdPlacementsMap;
};

export function isPlacementVisible(
  settings: AdPolicySettings,
  placement: AdPlacementId,
  audience: AdAudienceContext
): boolean {
  if (audience.userAdsHidden) return false;
  if (!settings.enabled) return false;
  if (settings.hideForLoggedInUsers && audience.isLoggedIn) return false;
  if (settings.placements[placement] === false) return false;
  return true;
}

export function countActiveAdUnits(settings: AdPolicySettings): {
  activeUnits: number;
  totalUnits: number;
  activePlacements: number;
  totalPlacements: number;
} {
  let activeUnits = 0;
  let totalUnits = 0;
  let activePlacements = 0;
  for (const p of AD_PLACEMENTS) {
    totalUnits += p.units;
    if (settings.placements[p.id] !== false) activePlacements += 1;
    if (settings.enabled && settings.placements[p.id] !== false) {
      activeUnits += p.units;
    }
  }
  return {
    activeUnits,
    totalUnits,
    activePlacements,
    totalPlacements: AD_PLACEMENTS.length,
  };
}
