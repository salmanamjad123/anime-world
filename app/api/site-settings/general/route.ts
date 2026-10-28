/**
 * GET /api/site-settings/general — public site flags (uncached).
 */

import { uncachedJson } from '@/lib/http-cache';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  readSiteGeneralSettings,
  toPublicGeneralSettings,
} from '@/lib/site-settings-general';
import { noteFirestoreError } from '@/lib/firebase/quota';

function defaults() {
  return { showMirrorLink: true };
}

export async function GET() {
  const db = getAdminFirestore();
  if (!db) {
    return uncachedJson(defaults(), 200);
  }

  try {
    const settings = await readSiteGeneralSettings(db);
    return uncachedJson(toPublicGeneralSettings(settings), 200);
  } catch (e) {
    noteFirestoreError(e);
    console.error('[site-settings/general]', e);
    return uncachedJson(defaults(), 200);
  }
}
