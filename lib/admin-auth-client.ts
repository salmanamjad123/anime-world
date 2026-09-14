/**
 * Client-side admin auth helpers (local static token + Firebase ID token)
 */

import { auth } from '@/lib/firebase/config';
import { LOCAL_ADMIN_TOKEN } from '@/lib/admin-constants';

export const LOCAL_ADMIN_TOKEN_KEY = 'anime_village_local_admin_token';

export function isAdminDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

export async function getAdminAuthToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const local = sessionStorage.getItem(LOCAL_ADMIN_TOKEN_KEY);
    if (local === LOCAL_ADMIN_TOKEN && isAdminDev()) return local;
  }
  const u = auth?.currentUser;
  if (!u) return null;
  return u.getIdToken();
}

export function clearLocalAdminSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(LOCAL_ADMIN_TOKEN_KEY);
}

export function hasLocalAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    isAdminDev() &&
    sessionStorage.getItem(LOCAL_ADMIN_TOKEN_KEY) === LOCAL_ADMIN_TOKEN
  );
}
