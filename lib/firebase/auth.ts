/**
 * Firebase Authentication Helpers
 * User authentication functions
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './config';
import type { User } from '@/types';

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, displayName?: string): Promise<User> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Update profile with display name
  if (displayName) {
    await updateProfile(firebaseUser, { displayName });
  }

  // Do NOT create user document here – created only after email verification in verify-code API

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName: displayName || firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined,
    createdAt: new Date(),
  };
}

/**
 * Sign in with email and password
 * Rejects if account is not verified (no user document in Firestore)
 */
export async function signIn(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Only update last login if user doc exists (verified account)
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const userDocSnap = await getDoc(userDocRef);
  if (!userDocSnap.exists()) {
    await firebaseSignOut(auth);
    throw new Error('Please verify your email first. Check your inbox for the verification code.');
  }

  await updateDoc(userDocRef, { lastLogin: serverTimestamp() });

  const data = userDocSnap.data()!;
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName: data.displayName ?? firebaseUser.displayName ?? undefined,
    photoURL: data.photoURL ?? firebaseUser.photoURL ?? undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  };
}

/**
 * Update user photo URL (e.g. after Cloudinary upload)
 */
export async function updateUserPhotoURL(photoURL: string | null): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('Not authenticated');
  if (photoURL) {
    await updateProfile(firebaseUser, { photoURL });
  }
  await updateDoc(doc(db, 'users', firebaseUser.uid), { photoURL: photoURL ?? null });
}

/**
 * Update user display name
 */
export async function updateUserDisplayName(displayName: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error('Not authenticated');
  await updateProfile(firebaseUser, { displayName });
  await updateDoc(doc(db, 'users', firebaseUser.uid), { displayName });
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }
  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  await firebaseSignOut(auth);
}

/**
 * Get current user
 */
export function getCurrentUser(): FirebaseUser | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}

/**
 * Get user document from Firestore
 */
export async function getUserDocument(uid: string): Promise<User | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      createdAt: data.createdAt?.toDate() || new Date(),
      lastLogin: data.lastLogin?.toDate(),
      emailVerified: data.emailVerified ?? false,
    };
  }

  return null;
}
