'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getComments,
  getReplies,
  getCommentCount,
  createComment,
  updateComment,
  deleteComment,
  toggleLike,
  subscribeToComments,
  subscribeToCommentCount,
  subscribeToReplies,
} from '@/lib/firebase/comments';
import type { Comment, CommentSortBy, CreateCommentInput } from '@/types/comment';

export function useComments(
  animeId: string,
  episodeId: string,
  sortBy: CommentSortBy = 'newest'
) {
  const queryClient = useQueryClient();
  const queryKey = ['comments', animeId, episodeId, sortBy];
  const countKey = ['comments-count', animeId, episodeId];

  const {
    data: comments = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => getComments(animeId, episodeId, sortBy),
    enabled: !!animeId && !!episodeId,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: countKey,
    queryFn: () => getCommentCount(animeId, episodeId),
    enabled: !!animeId && !!episodeId,
  });

  useEffect(() => {
    if (!animeId || !episodeId) return;
    const unsubComments = subscribeToComments(animeId, episodeId, sortBy, (data) => {
      queryClient.setQueryData(['comments', animeId, episodeId, sortBy], data);
    });
    const unsubCount = subscribeToCommentCount(animeId, episodeId, (count) => {
      queryClient.setQueryData(['comments-count', animeId, episodeId], count);
    });
    return () => {
      unsubComments();
      unsubCount();
    };
  }, [animeId, episodeId, sortBy, queryClient]);

  const createMutation = useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments-count', animeId, episodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments-replies', animeId, episodeId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      commentId,
      text,
    }: {
      commentId: string;
      text: string;
    }) => updateComment(animeId, episodeId, commentId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(animeId, episodeId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments-count', animeId, episodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments-replies', animeId, episodeId] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: ({
      commentId,
      userId,
      like,
    }: {
      commentId: string;
      userId: string;
      like: boolean;
    }) => toggleLike(animeId, episodeId, commentId, userId, like),
    onMutate: async ({ commentId, userId, like }) => {
      const updateCommentInCache = (c: { id: string; likes: number; likedBy: string[]; likedByDownvote: string[] }) => {
        if (c.id !== commentId) return c;
        const hasLike = c.likedBy.includes(userId);
        const hasDislike = c.likedByDownvote.includes(userId);
        let newLikes = c.likes;
        let newLikedBy = [...c.likedBy];
        let newLikedByDownvote = [...c.likedByDownvote];
        if (like) {
          if (hasLike) {
            newLikedBy = newLikedBy.filter((id) => id !== userId);
            newLikes = c.likes - 1;
          } else {
            newLikedByDownvote = newLikedByDownvote.filter((id) => id !== userId);
            newLikedBy = newLikedBy.filter((id) => id !== userId).concat(userId);
            newLikes = c.likes + (hasDislike ? 2 : 1);
          }
        } else {
          if (hasDislike) {
            newLikedByDownvote = newLikedByDownvote.filter((id) => id !== userId);
            newLikes = c.likes + 1;
          } else {
            newLikedBy = newLikedBy.filter((id) => id !== userId);
            newLikedByDownvote = newLikedByDownvote.filter((id) => id !== userId).concat(userId);
            newLikes = c.likes - (hasLike ? 2 : 1);
          }
        }
        return { ...c, likes: newLikes, likedBy: newLikedBy, likedByDownvote: newLikedByDownvote };
      };
      await queryClient.cancelQueries({ queryKey: ['comments', animeId, episodeId] });
      await queryClient.cancelQueries({ queryKey: ['comments-replies', animeId, episodeId] });
      type CommentLike = { id: string; likes: number; likedBy: string[]; likedByDownvote: string[] };
      queryClient.setQueriesData(
        { queryKey: ['comments', animeId, episodeId] },
        (old: unknown) => (Array.isArray(old) ? old.map((c: CommentLike) => updateCommentInCache(c)) : old)
      );
      queryClient.setQueriesData(
        { queryKey: ['comments-replies', animeId, episodeId] },
        (old: unknown) => (Array.isArray(old) ? old.map((c: CommentLike) => updateCommentInCache(c)) : old)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', animeId, episodeId] });
      queryClient.invalidateQueries({ queryKey: ['comments-replies', animeId, episodeId] });
    },
  });

  return {
    comments,
    totalCount,
    isLoading,
    error,
    refetch,
    createComment: createMutation.mutateAsync,
    updateComment: updateMutation.mutateAsync,
    deleteComment: deleteMutation.mutateAsync,
    toggleLike: likeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useReplies(animeId: string, episodeId: string, parentId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['comments-replies', animeId, episodeId, parentId];

  const { data: replies = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getReplies(animeId, episodeId, parentId!),
    enabled: !!animeId && !!episodeId && !!parentId,
  });

  useEffect(() => {
    if (!animeId || !episodeId || !parentId) return;
    const unsub = subscribeToReplies(animeId, episodeId, parentId, (data) => {
      queryClient.setQueryData(['comments-replies', animeId, episodeId, parentId], data);
    });
    return () => unsub();
  }, [animeId, episodeId, parentId, queryClient]);

  return { replies, isLoading };
}
