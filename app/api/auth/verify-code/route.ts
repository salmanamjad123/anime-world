/**
 * POST /api/auth/verify-code
 * Verifies the 6-digit code and marks user email as verified in Firestore
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
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

    // Update user document if exists (users/{uid} has emailVerified)
    const usersSnapshot = await db
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (!usersSnapshot.empty) {
      const userDoc = usersSnapshot.docs[0];
      await userDoc.ref.update({
        emailVerified: true,
        emailVerifiedAt: new Date(),
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
