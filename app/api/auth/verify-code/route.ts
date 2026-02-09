/**
 * POST /api/auth/verify-code
 * Verifies the 6-digit code and creates user document in Firestore (account is created only after verification)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin';
import { authRateLimiters, getClientIdentifier } from '@/lib/utils/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const clientId = `${getClientIdentifier(request)}:auth:verify-code`;
    const { allowed, resetTime } = authRateLimiters.verifyCode.check(clientId);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { email, code } = body;

    if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const codeStr = code.trim().replace(/\s/g, '');

    if (codeStr.length !== 6 || !/^\d{6}$/.test(codeStr)) {
      return NextResponse.json(
        { error: 'Invalid code format (must be 6 digits)' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const docId = normalizedEmail.replace(/[.$#[\]/]/g, '_');
    const docRef = db.collection('verification_codes').doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: 'Code expired or not found. Please request a new code.' },
        { status: 400 }
      );
    }

    const data = docSnap.data()!;
    const storedCode = data.code;
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(0);

    if (new Date() > expiresAt) {
      await docRef.delete();
      return NextResponse.json(
        { error: 'Code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    if (storedCode !== codeStr) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Delete used code
    await docRef.delete();

    // Create user document in Firestore only after verification
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Auth service not configured' },
        { status: 503 }
      );
    }

    let firebaseUser;
    try {
      firebaseUser = await adminAuth.getUserByEmail(normalizedEmail);
    } catch {
      return NextResponse.json(
        { error: 'User not found. Please register first.' },
        { status: 400 }
      );
    }

    const userRef = db.collection('users').doc(firebaseUser.uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      // Already verified (doc exists) - just update emailVerified
      await userRef.update({
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
    } else {
      // First verification - create user document
      await userRef.set({
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        ...(firebaseUser.displayName ? { displayName: firebaseUser.displayName } : {}),
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {}),
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('[verify-code] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
