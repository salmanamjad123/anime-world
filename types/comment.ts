/**
 * Comment types for episode comments
 */

export interface Comment {
  id: string;
  animeId: string;
  episodeId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  parentId?: string | null;
  likes: number;
  likedBy: string[];
  likedByDownvote: string[];
  replyCount?: number;
}

export type CommentSortBy = 'newest' | 'oldest' | 'popular';

export interface CreateCommentInput {
  animeId: string;
  episodeId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  parentId?: string | null;
}
