/**
 * Firebase Admin SDK - Server-side only
 * Used for Firestore in API routes (stream cache, etc.)
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string of service account key)
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { Firestore } from 'firebase-admin/firestore';

let admin: typeof import('firebase-admin') | null = null;
let firestore: Firestore | null = null;

/**
 * Next/dotenv often break nested JSON in .env when written as:
 *   FIREBASE_SERVICE_ACCOUNT_JSON="{"type":"..."}"
 * Extract the {...} object from the .env file as a fallback.
 */
function loadServiceAccountFromEnvFile(): Record<string, string> | null {
  try {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) return null;
    const text = readFileSync(envPath, 'utf8');
    const key = 'FIREBASE_SERVICE_ACCOUNT_JSON';
    const idx = text.indexOf(key);
    if (idx === -1) return null;
    const rest = text.slice(idx);
    const nextKey = rest.search(/\n[A-Z_]+=/);
    const chunk = nextKey === -1 ? rest : rest.slice(0, nextKey);
    const brace = chunk.indexOf('{');
    const last = chunk.lastIndexOf('}');
    if (brace === -1 || last === -1) return null;
    return JSON.parse(chunk.slice(brace, last + 1)) as Record<string, string>;
  } catch {
    return null;
  }
}

function parseServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw && raw.length > 2) {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      /* try .env file fallback */
    }
  }
  return loadServiceAccountFromEnvFile();
}

function getAdmin() {
  if (admin) return admin;

  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  try {
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

export function getAdminAuth() {
  const adm = getAdmin();
  return adm?.auth() ?? null;
}

export function isFirebaseAdminConfigured(): boolean {
  return !!parseServiceAccount();
}
