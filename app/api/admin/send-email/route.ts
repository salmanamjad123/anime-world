/**
 * POST /api/admin/send-email — engagement email to selected or all users
 * Body: { subject, body, uids?: string[], sendToAll?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { isEmailConfigured, sendEngagementEmail } from '@/lib/email';

const MAX_RECIPIENTS = 100;
const DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Email not configured (RESEND_API_KEY)' },
      { status: 503 }
    );
  }

  const db = getAdminFirestore();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    const sendToAll = body.sendToAll === true;
    const uids = Array.isArray(body.uids)
      ? body.uids.filter((u: unknown) => typeof u === 'string')
      : [];

    if (!subject || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject required (max 200 chars)' },
        { status: 400 }
      );
    }
    if (!message || message.length > 10000) {
      return NextResponse.json(
        { error: 'Body required (max 10000 chars)' },
        { status: 400 }
      );
    }
    if (!sendToAll && uids.length === 0) {
      return NextResponse.json(
        { error: 'Select users or enable send to all' },
        { status: 400 }
      );
    }

    let recipients: { uid: string; email: string }[] = [];

    if (sendToAll) {
      const snap = await db.collection('users').get();
      recipients = snap.docs
        .map((d) => ({
          uid: d.id,
          email: String(d.data().email || '').trim().toLowerCase(),
        }))
        .filter((r) => r.email.includes('@'));
    } else {
      for (const uid of uids.slice(0, MAX_RECIPIENTS)) {
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) continue;
        const email = String(snap.data()?.email || '').trim().toLowerCase();
        if (email.includes('@')) recipients.push({ uid, email });
      }
    }

    // Dedupe by email
    const seen = new Set<string>();
    recipients = recipients.filter((r) => {
      if (seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No valid recipients' }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        {
          error: `Too many recipients (${recipients.length}). Max ${MAX_RECIPIENTS} per send.`,
        },
        { status: 400 }
      );
    }

    const results: { email: string; ok: boolean; error?: string }[] = [];
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        await sendEngagementEmail(r.email, subject, message);
        results.push({ email: r.email, ok: true });
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Send failed';
        results.push({ email: r.email, ok: false, error: msg });
        failed++;
      }
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      total: recipients.length,
      results,
    });
  } catch (e) {
    console.error('[admin/send-email]', e);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
