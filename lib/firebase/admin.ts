/**
 * Firebase Admin SDK - Server-side only
 * Used for Firestore in API routes (stream cache, etc.)
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string of service account key)
 * Or GOOGLE_APPLICATION_CREDENTIALS for local file path
 */

import type { Firestore } from 'firebase-admin/firestore';

let admin: typeof import('firebase-admin') | null = null;
let firestore: Firestore | null = null;

function getAdmin() {
  if (admin) return admin;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as Record<string, string>;
    const adminModule = require('firebase-admin').default;
    admin = adminModule;

    if (!adminModule.apps.length) {
      adminModule.initializeApp({
        credential: adminModule.credential.cert(serviceAccount),
      });
    }

    return adminModule;
  } catch (err) {
    console.warn('[Firebase Admin] Init failed:', (err as Error).message);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  if (firestore) return firestore;

  const adm = getAdmin();
  if (!adm) return null;

  firestore = adm.firestore();
  return firestore;
}

export function isFirebaseAdminConfigured(): boolean {
  return !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
}
