/**
 * Firestore helpers for episode comments
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  where,
  getDoc,
  writeBatch,
  onSnapshot,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import type { Comment, CreateCommentInput } from '@/types/comment';

// Sanitize episodeId for Firestore path (doc IDs cannot contain /)
function sanitizeEpisodeId(episodeId: string): string {
  return episodeId.replace(/\//g, '_');
}

function commentsRef(animeId: string, episodeId: string) {
  const epId = sanitizeEpisodeId(episodeId);
  return collection(db, 'comments', animeId, 'episodes', epId, 'comments');
}

function commentDoc(animeId: string, episodeId: string, commentId: string) {
  const epId = sanitizeEpisodeId(episodeId);
  return doc(db, 'comments', animeId, 'episodes', epId, 'comments', commentId);
}

function mapDocToComment(docSnap: { id: string; data: () => DocumentData }): Comment {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    animeId: d.animeId,
    episodeId: d.episodeId,
    userId: d.userId,
    displayName: d.displayName || 'Anonymous',
    photoURL: d.photoURL,
    text: d.text,
    createdAt: d.createdAt?.toDate?.() || new Date(),
    updatedAt: d.updatedAt?.toDate?.() || new Date(),
    parentId: d.parentId ?? null,
    likes: d.likes ?? 0,
    likedBy: d.likedBy ?? [],
    likedByDownvote: d.likedByDownvote ?? [],
    replyCount: d.replyCount ?? 0,
  };
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const ref = doc(commentsRef(input.animeId, input.episodeId));
  const commentId = ref.id;

  const data: DocumentData = {
    id: commentId,
    animeId: input.animeId,
    episodeId: input.episodeId,
    userId: input.userId,
    displayName: input.displayName,
    photoURL: input.photoURL ?? null,
    text: input.text.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    parentId: input.parentId ?? null,
    likes: 0,
    likedBy: [],
    likedByDownvote: [],
  };

  await setDoc(ref, data);

  return {
    id: commentId,
    animeId: input.animeId,
    episodeId: input.episodeId,
    userId: input.userId,
    displayName: input.displayName,
    photoURL: input.photoURL,
    text: input.text.trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
    parentId: input.parentId ?? null,
    likes: 0,
    likedBy: [],
    likedByDownvote: [],
  };
}

export async function getComments(
  animeId: string,
  episodeId: string,
  sortBy: 'newest' | 'oldest' | 'popular' = 'newest',
  maxCount: number = 100
): Promise<Comment[]> {
  const all = await getAllCommentsForEpisode(animeId, episodeId, maxCount * 3);
  let comments = all.filter((c) => !c.parentId);

  if (sortBy === 'newest') {
    comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else if (sortBy === 'oldest') {
    comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  } else if (sortBy === 'popular') {
    comments.sort((a, b) => b.likes - a.likes);
  }

  return comments.slice(0, maxCount);
}

export async function getReplies(
  animeId: string,
  episodeId: string,
  parentId: string
): Promise<Comment[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const ref = commentsRef(animeId, episodeId);
  const q = query(
    ref,
    where('parentId', '==', parentId),
    orderBy('createdAt', 'asc')
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) =>
      mapDocToComment({ id: d.id, data: () => d.data() })
    );
  } catch (e) {
    // Fallback: fetch all and filter if composite index not yet created
    const all = await getAllCommentsForEpisode(animeId, episodeId, 500);
    return all
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}

export async function getAllCommentsForEpisode(
  animeId: string,
  episodeId: string,
  maxCount: number = 500
): Promise<Comment[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  const ref = commentsRef(animeId, episodeId);
  const q = query(ref, orderBy('createdAt', 'asc'), limit(maxCount));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) =>
    mapDocToComment({ id: d.id, data: () => d.data() })
  );
}

export async function getCommentCount(
  animeId: string,
  episodeId: string
): Promise<number> {
  if (!isFirebaseConfigured()) {
    return 0;
  }

  const snapshot = await getDocs(commentsRef(animeId, episodeId));
  return snapshot.size;
}

/** Real-time: subscribe to comments. Returns unsubscribe function. */
export function subscribeToComments(
  animeId: string,
  episodeId: string,
  sortBy: 'newest' | 'oldest' | 'popular',
  callback: (comments: Comment[]) => void,
  maxCount: number = 100
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  const ref = commentsRef(animeId, episodeId);
  const q = query(ref, orderBy('createdAt', 'asc'), limit(maxCount * 3));

  return onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) =>
      mapDocToComment({ id: d.id, data: () => d.data() })
    );
    let comments = all.filter((c) => !c.parentId);

    if (sortBy === 'newest') {
      comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sortBy === 'oldest') {
      comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } else if (sortBy === 'popular') {
      comments.sort((a, b) => b.likes - a.likes);
    }

    callback(comments.slice(0, maxCount));
  });
}

/** Real-time: subscribe to replies. Returns unsubscribe function. */
export function subscribeToReplies(
  animeId: string,
  episodeId: string,
  parentId: string,
  callback: (replies: Comment[]) => void
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  const ref = commentsRef(animeId, episodeId);
  const q = query(ref, orderBy('createdAt', 'asc'), limit(500));

  return onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) =>
      mapDocToComment({ id: d.id, data: () => d.data() })
    );
    const replies = all
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    callback(replies);
  });
}

/** Real-time: subscribe to comment count. Returns unsubscribe function. */
export function subscribeToCommentCount(
  animeId: string,
  episodeId: string,
  callback: (count: number) => void
): Unsubscribe {
  if (!isFirebaseConfigured()) {
    return () => {};
  }

  const ref = commentsRef(animeId, episodeId);
  return onSnapshot(ref, (snapshot) => {
    callback(snapshot.size);
  });
}

export async function updateComment(
  animeId: string,
  episodeId: string,
  commentId: string,
  text: string
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const ref = commentDoc(animeId, episodeId, commentId);
  await setDoc(
    ref,
    { text: text.trim(), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function deleteComment(
  animeId: string,
  episodeId: string,
  commentId: string
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const ref = commentDoc(animeId, episodeId, commentId);
  await deleteDoc(ref);
}

export async function toggleLike(
  animeId: string,
  episodeId: string,
  commentId: string,
  userId: string,
  like: boolean
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  const ref = commentDoc(animeId, episodeId, commentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const likedBy: string[] = data?.likedBy ?? [];
  const likedByDownvote: string[] = data?.likedByDownvote ?? [];

  const hasLike = likedBy.includes(userId);
  const hasDislike = likedByDownvote.includes(userId);

  const batch = writeBatch(db);

  if (like) {
    if (hasLike) {
      batch.update(ref, {
        likedBy: likedBy.filter((id) => id !== userId),
        likes: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } else {
      const newLikedBy = [...likedBy.filter((id) => id !== userId), userId];
      const newLikedByDownvote = likedByDownvote.filter((id) => id !== userId);
      batch.update(ref, {
        likedBy: newLikedBy,
        likedByDownvote: newLikedByDownvote,
        likes: increment(hasDislike ? 2 : 1),
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    if (hasDislike) {
      batch.update(ref, {
        likedByDownvote: likedByDownvote.filter((id) => id !== userId),
        likes: increment(1),
        updatedAt: serverTimestamp(),
      });
    } else {
      const newLikedByDownvote = [...likedByDownvote.filter((id) => id !== userId), userId];
      const newLikedBy = likedBy.filter((id) => id !== userId);
      batch.update(ref, {
        likedByDownvote: newLikedByDownvote,
        likedBy: newLikedBy,
        likes: increment(hasLike ? -2 : -1),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
