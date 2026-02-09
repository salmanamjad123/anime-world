/**
 * Profile photo upload - Cloudinary
 * Stores in anime-world/avatars/{userId}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';
import { uploadAvatar, deleteAvatar, extractPublicIdFromCloudinaryUrl, isCloudinaryConfigured } from '@/lib/cloudinary';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  try {
    const adminAuth = getAdminAuth();
    const adminFirestore = getAdminFirestore();
    if (!adminAuth || !adminFirestore) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Verify auth via Bearer token (ID token from client)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decodedToken.uid;

    const userRef = adminFirestore.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const oldPhotoURL = userSnap.exists ? (userSnap.data()?.photoURL as string | undefined) : undefined;

    if (!isCloudinaryConfigured()) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAvatar(userId, buffer, file.type);

    await userRef.update({ photoURL: result.secureUrl });

    const oldPublicId = extractPublicIdFromCloudinaryUrl(oldPhotoURL ?? '');
    if (oldPublicId) {
      try {
        await deleteAvatar(oldPublicId);
      } catch (delErr) {
        console.warn('Failed to delete old avatar from Cloudinary:', delErr);
      }
    }

    return NextResponse.json({ url: result.secureUrl });
  } catch (err) {
    console.error('Upload photo error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
