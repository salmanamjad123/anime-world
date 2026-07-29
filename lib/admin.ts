/**
 * Admin access — ADMIN_EMAILS (prod) + static local login (dev only).
 */

import { NextRequest } from 'next/server';
import { getAdminAuth } from '@/lib/firebase/admin';
import { LOCAL_ADMIN_TOKEN } from '@/lib/admin-constants';

export { LOCAL_ADMIN_TOKEN };

/** Local-only static admin (NODE_ENV=development). Never enable in production. */
export const LOCAL_ADMIN_EMAIL = 'admin@gmail.com';
export const LOCAL_ADMIN_PASSWORD = '12345678';

export function isLocalAdminEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export type AdminAuthResult =
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; error: string };

/** Verify Bearer ID token (or local static token in development). */
export async function requireAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  // Dev-only static admin token
  if (isLocalAdminEnabled() && token === LOCAL_ADMIN_TOKEN) {
    return {
      ok: true,
      uid: 'local-admin',
      email: LOCAL_ADMIN_EMAIL,
    };
  }

  const admins = getAdminEmails();
  if (admins.length === 0) {
    return {
      ok: false,
      status: 503,
      error: 'Admin not configured. Set ADMIN_EMAILS in env.',
    };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return { ok: false, status: 503, error: 'Firebase Admin not configured' };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    if (!isAdminEmail(email)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return { ok: true, uid: decoded.uid, email };
  } catch {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
}
