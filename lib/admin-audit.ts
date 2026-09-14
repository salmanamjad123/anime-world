/**
 * Admin audit logs — Firestore collection admin_audit_logs
 * Auto-purged after AUDIT_RETENTION_DAYS via cron.
 */

import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const ADMIN_AUDIT_COLLECTION = 'admin_audit_logs';
export const AUDIT_RETENTION_DAYS = 15;

export type AdminAuditAction =
  | 'view_users'
  | 'view_user'
  | 'send_email'
  | 'purge_audits'
  | 'admin_login';

export type AdminAuditEntry = {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: AdminAuditAction | string;
  targetUid?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string | null;
};

export async function writeAdminAudit(
  db: Firestore,
  params: {
    actorUid: string;
    actorEmail: string;
    action: AdminAuditAction | string;
    targetUid?: string;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await db.collection(ADMIN_AUDIT_COLLECTION).add({
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      action: params.action,
      targetUid: params.targetUid ?? null,
      meta: params.meta ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[admin-audit] write failed', e);
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') {
    try {
      return maybe.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeAuditDoc(
  id: string,
  data: Record<string, unknown>
): AdminAuditEntry {
  return {
    id,
    actorUid: String(data.actorUid || ''),
    actorEmail: String(data.actorEmail || ''),
    action: String(data.action || ''),
    targetUid: data.targetUid ? String(data.targetUid) : null,
    meta: (data.meta as Record<string, unknown>) ?? null,
    createdAt: toIso(data.createdAt),
  };
}

/** Delete audit docs older than retention. Returns deleted count. */
export async function purgeOldAdminAudits(
  db: Firestore,
  retentionDays: number = AUDIT_RETENTION_DAYS
): Promise<number> {
  const cutoff = Timestamp.fromDate(
    new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  );

  let deleted = 0;
  // Paginate: Firestore batch limit 500
  for (;;) {
    const snap = await db
      .collection(ADMIN_AUDIT_COLLECTION)
      .where('createdAt', '<', cutoff)
      .limit(500)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < 500) break;
  }

  return deleted;
}
