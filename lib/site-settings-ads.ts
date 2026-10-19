import type { Firestore } from 'firebase-admin/firestore';
import {
  defaultAdPlacements,
  normalizeAdPlacements,
  type AdPlacementsMap,
  type AdPolicySettings,
} from '@/lib/ads-placements';
import {
  firestoreBudget,
  isFirestoreQuotaBlocked,
  noteFirestoreError,
} from '@/lib/firebase/quota';

export const SITE_SETTINGS_COLLECTION = 'site_settings';
export const SITE_SETTINGS_ADS_DOC = 'ads';

export type SiteAdsSettings = AdPolicySettings & {
  updatedAt: string | null;
  updatedBy: string | null;
};

export type SiteAdsSettingsPublic = AdPolicySettings;

function parseSettingsData(
  data: Record<string, unknown> | undefined
): SiteAdsSettingsPublic {
  return {
    enabled: data?.enabled !== false,
    hideForLoggedInUsers: data?.hideForLoggedInUsers !== false,
    showAdFreeLoginBanner: data?.showAdFreeLoginBanner === true,
    placements: normalizeAdPlacements(
      data?.placements as Partial<AdPlacementsMap> | undefined
    ),
  };
}

const ADS_MEM_TTL_MS = 5 * 60 * 1000;
let adsMem: { at: number; value: SiteAdsSettings } | null = null;

function defaultSiteAdsSettings(): SiteAdsSettings {
  return {
    enabled: true,
    hideForLoggedInUsers: true,
    showAdFreeLoginBanner: false,
    placements: defaultAdPlacements(),
    updatedAt: null,
    updatedBy: null,
  };
}

export function clearAdsSettingsCache(): void {
  adsMem = null;
}

export function writeAdsSettingsCache(value: SiteAdsSettings): void {
  adsMem = { at: Date.now(), value };
}

export async function readSiteAdsSettings(
  db: Firestore
): Promise<SiteAdsSettings> {
  if (adsMem && Date.now() - adsMem.at < ADS_MEM_TTL_MS) {
    return adsMem.value;
  }
  if (isFirestoreQuotaBlocked()) {
    return adsMem?.value ?? defaultSiteAdsSettings();
  }

  try {
    const snap = await firestoreBudget(
      db
        .collection(SITE_SETTINGS_COLLECTION)
        .doc(SITE_SETTINGS_ADS_DOC)
        .get(),
      null
    );

    if (!snap?.exists) {
      const missing = defaultSiteAdsSettings();
      adsMem = { at: Date.now(), value: missing };
      return missing;
    }

    const data = snap.data();
    const core = parseSettingsData(data);
    const value: SiteAdsSettings = {
      ...core,
      updatedAt:
        data?.updatedAt?.toDate?.()?.toISOString?.() ??
        (typeof data?.updatedAt === 'string' ? data.updatedAt : null),
      updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
    };
    adsMem = { at: Date.now(), value };
    return value;
  } catch (err) {
    noteFirestoreError(err);
    return adsMem?.value ?? defaultSiteAdsSettings();
  }
}

export function toPublicAdsSettings(
  settings: SiteAdsSettings
): SiteAdsSettingsPublic {
  return {
    enabled: settings.enabled,
    hideForLoggedInUsers: settings.hideForLoggedInUsers,
    showAdFreeLoginBanner: settings.showAdFreeLoginBanner,
    placements: settings.placements,
  };
}
