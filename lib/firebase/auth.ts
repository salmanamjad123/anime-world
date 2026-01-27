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
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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

  // Create user document in Firestore
  const user: User = {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName: displayName || firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined,
    createdAt: new Date(),
  };

  await setDoc(doc(db, 'users', firebaseUser.uid), {
    ...user,
    createdAt: serverTimestamp(),
  });

  return user;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<User> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Update last login
  await setDoc(
    doc(db, 'users', firebaseUser.uid),
    { lastLogin: serverTimestamp() },
    { merge: true }
  );

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName: firebaseUser.displayName || undefined,
    photoURL: firebaseUser.photoURL || undefined,
    createdAt: new Date(),
  };
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
    };
  }

  return null;
}
