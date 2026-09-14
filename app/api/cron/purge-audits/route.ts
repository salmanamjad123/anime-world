/**
 * GET /api/cron/purge-audits — delete admin_audit_logs older than 15 days
 * Schedule: daily (see vercel.json)
 * Auth: Authorization: Bearer $CRON_SECRET
 */

import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  AUDIT_RETENTION_DAYS,
  purgeOldAdminAudits,
  writeAdminAudit,
} from '@/lib/admin-audit';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const deleted = await purgeOldAdminAudits(db, AUDIT_RETENTION_DAYS);
    await writeAdminAudit(db, {
      actorUid: 'cron',
      actorEmail: 'cron@system',
      action: 'purge_audits',
      meta: { deleted, retentionDays: AUDIT_RETENTION_DAYS },
    });

    return NextResponse.json({
      ok: true,
      deleted,
      retentionDays: AUDIT_RETENTION_DAYS,
    });
  } catch (e) {
    console.error('[cron/purge-audits]', e);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
