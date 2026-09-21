import type { Firestore } from 'firebase-admin/firestore';

export const SITE_SETTINGS_COLLECTION = 'site_settings';
export const SITE_SETTINGS_ADS_DOC = 'ads';

export type SiteAdsSettings = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export async function readSiteAdsSettings(
  db: Firestore
): Promise<SiteAdsSettings> {
  const snap = await db
    .collection(SITE_SETTINGS_COLLECTION)
    .doc(SITE_SETTINGS_ADS_DOC)
    .get();

  if (!snap.exists) {
    return { enabled: true, updatedAt: null, updatedBy: null };
  }

  const data = snap.data();
  return {
    enabled: data?.enabled !== false,
    updatedAt:
      data?.updatedAt?.toDate?.()?.toISOString?.() ??
      (typeof data?.updatedAt === 'string' ? data.updatedAt : null),
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
  };
}
