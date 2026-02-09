/**
 * POST /api/auth/send-verification
 * Generates 6-digit code, stores in Firestore, sends via Nodemailer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { sendVerificationCode, isEmailConfigured } from '@/lib/email';
import { authRateLimiters, getClientIdentifier } from '@/lib/utils/rate-limiter';

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 10;

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const clientId = `${getClientIdentifier(request)}:auth:send-verification`;
    const { allowed, resetTime } = authRateLimiters.sendVerification.check(clientId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: 'Email service is not configured' },
        { status: 503 }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // Store in Firestore: verification_codes/{email}
    const docId = normalizedEmail.replace(/[.$#[\]/]/g, '_'); // Safe Firestore doc ID
    await db.collection('verification_codes').doc(docId).set({
      code,
      email: normalizedEmail,
      expiresAt,
      createdAt: new Date(),
    });

    await sendVerificationCode(normalizedEmail, code);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[send-verification] Error:', err.message, err);
    // Return actual error message so user can debug (e.g. "Invalid login", "Connection refused")
    const message = err.message || 'Failed to send verification code';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
