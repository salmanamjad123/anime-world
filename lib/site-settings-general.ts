import type { Firestore } from 'firebase-admin/firestore';
import {
  firestoreBudget,
  isFirestoreQuotaBlocked,
  noteFirestoreError,
} from '@/lib/firebase/quota';

export const SITE_SETTINGS_COLLECTION = 'site_settings';
export const SITE_SETTINGS_GENERAL_DOC = 'general';

export type SiteGeneralSettings = {
  /** Show animevillage.my links in home intro + footer */
  showMirrorLink: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type SiteGeneralSettingsPublic = {
  showMirrorLink: boolean;
};

const MEM_TTL_MS = 60 * 1000;
let mem: { at: number; value: SiteGeneralSettings } | null = null;

function defaultSettings(): SiteGeneralSettings {
  return {
    showMirrorLink: true,
    updatedAt: null,
    updatedBy: null,
  };
}

export function clearGeneralSettingsCache(): void {
  mem = null;
}

export function writeGeneralSettingsCache(value: SiteGeneralSettings): void {
  mem = { at: Date.now(), value };
}

export async function readSiteGeneralSettings(
  db: Firestore
): Promise<SiteGeneralSettings> {
  if (mem && Date.now() - mem.at < MEM_TTL_MS) {
    return mem.value;
  }
  if (isFirestoreQuotaBlocked()) {
    return mem?.value ?? defaultSettings();
  }

  try {
    const snap = await firestoreBudget(
      db
        .collection(SITE_SETTINGS_COLLECTION)
        .doc(SITE_SETTINGS_GENERAL_DOC)
        .get(),
      null
    );

    if (!snap?.exists) {
      const missing = defaultSettings();
      mem = { at: Date.now(), value: missing };
      return missing;
    }

    const data = snap.data();
    const value: SiteGeneralSettings = {
      showMirrorLink: data?.showMirrorLink !== false,
      updatedAt:
        data?.updatedAt?.toDate?.()?.toISOString?.() ??
        (typeof data?.updatedAt === 'string' ? data.updatedAt : null),
      updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null,
    };
    mem = { at: Date.now(), value };
    return value;
  } catch (err) {
    noteFirestoreError(err);
    return mem?.value ?? defaultSettings();
  }
}

export function toPublicGeneralSettings(
  settings: SiteGeneralSettings
): SiteGeneralSettingsPublic {
  return { showMirrorLink: settings.showMirrorLink };
}
