import type { Firestore } from 'firebase-admin/firestore';
import {
  defaultAdPlacements,
  normalizeAdPlacements,
  type AdPlacementsMap,
  type AdPolicySettings,
} from '@/lib/ads-placements';

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
    showAdFreeLoginBanner: data?.showAdFreeLoginBanner !== false,
    placements: normalizeAdPlacements(
      data?.placements as Partial<AdPlacementsMap> | undefined
    ),
  };
}

export async function readSiteAdsSettings(
  db: Firestore
): Promise<SiteAdsSettings> {
  const snap = await db
    .collection(SITE_SETTINGS_COLLECTION)
    .doc(SITE_SETTINGS_ADS_DOC)
    .get();

  if (!snap.exists) {
    return {
      enabled: true,
      hideForLoggedInUsers: true,
      showAdFreeLoginBanner: true,
      placements: defaultAdPlacements(),
      updatedAt: null,
      updatedBy: null,
    };
  }

  const data = snap.data();
  const core = parseSettingsData(data);
  return {
    ...core,
    updatedAt:
      data?.updatedAt?.toDate?.()?.toISOString?.() ??
      (typeof data?.updatedAt === 'string' ? data.updatedAt : null),
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
  };
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
