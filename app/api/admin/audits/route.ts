/**
 * GET /api/admin/audits — list recent admin audit logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  ADMIN_AUDIT_COLLECTION,
  AUDIT_RETENTION_DAYS,
  serializeAuditDoc,
} from '@/lib/admin-audit';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '50');
  const limit = Math.min(Math.max(1, Number.isFinite(limitParam) ? limitParam : 50), 200);

  try {
    const snap = await db
      .collection(ADMIN_AUDIT_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const audits = snap.docs.map((d) =>
      serializeAuditDoc(d.id, d.data() as Record<string, unknown>)
    );

    return NextResponse.json({
      audits,
      total: audits.length,
      retentionDays: AUDIT_RETENTION_DAYS,
    });
  } catch (e) {
    console.error('[admin/audits]', e);
    return NextResponse.json(
      {
        error:
          'Failed to list audits. If this is the first run, ensure Firestore index on createdAt exists (auto-created on first write + query).',
      },
      { status: 500 }
    );
  }
}
