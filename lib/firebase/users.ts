/**
 * Firestore user profile helpers
 * Used for comments, etc. - fetch current profile (photoURL, displayName)
 */

import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';

export async function getUserPhotoURL(uid: string): Promise<string | undefined> {
  if (!isFirebaseConfigured()) return undefined;
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data()?.photoURL as string | undefined) : undefined;
}
