'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Reply, MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useReplies } from '@/hooks/useComments';
import { useUserPhoto } from '@/hooks/useUserPhoto';
import { CommentInput } from './CommentInput';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { Comment } from '@/types/comment';

interface CommentItemProps {
  comment: Comment;
  animeId: string;
  episodeId: string;
  onReply: (text: string, parentId: string) => Promise<void>;
  onEdit: (commentId: string, text: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLike: (commentId: string, like: boolean) => void;
  isReply?: boolean;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} months ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

export function CommentItem({
  comment,
  animeId,
  episodeId,
  onReply,
  onEdit,
  onDelete,
  onLike,
  isReply,
}: CommentItemProps) {
  const { user } = useUserStore();
  const fetchedPhoto = useUserPhoto(comment.userId);
  const photoURL = user?.uid === comment.userId ? user.photoURL : fetchedPhoto;
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [reported, setReported] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editText, setEditText] = useState(comment.text);

  const { replies, isLoading: repliesLoading } = useReplies(
    animeId,
    episodeId,
    comment.id
  );

  const isOwn = user?.uid === comment.userId;
  const hasLiked = user ? comment.likedBy.includes(user.uid) : false;
  const hasDisliked = user ? comment.likedByDownvote.includes(user.uid) : false;

  const handleReplySubmit = async (text: string) => {
    setIsReplying(true);
    try {
      await onReply(text, comment.id);
      setShowReplyInput(false);
    } finally {
      setIsReplying(false);
    }
  };

  const handleSaveEdit = async () => {
    if (editText.trim() !== comment.text) {
      await onEdit(comment.id, editText.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className={cn('py-3', isReply && 'pl-8 sm:pl-12 border-l-2 border-gray-700/50 ml-4')}>
      <div className="flex gap-3">
        <div className="shrink-0">
          <UserAvatar
            photoURL={photoURL}
            name={comment.displayName}
            size="sm"
            className="w-9 h-9"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-white">{comment.displayName}</span>
            <span className="text-gray-500 text-xs">{formatTimeAgo(comment.createdAt)}</span>
          </div>

          {isEditing ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500 text-sm resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditText(comment.text);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap break-words">
              {comment.text}
            </p>
          )}

          {!isEditing && (
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <button
                type="button"
                onClick={() => user && setShowReplyInput(!showReplyInput)}
                className="inline-flex items-center gap-1.5 text-gray-400 hover:text-blue-400 text-xs font-medium transition-colors"
              >
                <Reply className="w-3.5 h-3.5" />
                Reply
              </button>
              <button
                type="button"
                onClick={() => user && onLike(comment.id, true)}
                disabled={!user}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
                  hasLiked ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'
                )}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                {comment.likes > 0 ? comment.likes : ''}
              </button>
              <button
                type="button"
                onClick={() => user && onLike(comment.id, false)}
                disabled={!user}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
                  hasDisliked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'
                )}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                {comment.likedByDownvote.length > 0 ? comment.likedByDownvote.length : ''}
              </button>
              {user && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMore(!showMore)}
                    className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    More
                  </button>
                  {showMore && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        aria-hidden
                        onClick={() => setShowMore(false)}
                      />
                      <div className="absolute left-0 top-full mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[120px]">
                        {isOwn ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditing(true);
                                setShowMore(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDelete(comment.id);
                                setShowMore(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReported(true);
                              setShowMore(false);
                            }}
                            disabled={reported}
                            className={cn(
                              'w-full px-3 py-2 text-left text-sm',
                              reported ? 'text-gray-500 cursor-default' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                            )}
                          >
                            {reported ? 'Reported as spam' : 'Report spam'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showReplyInput && (
          <motion.div
            initial={{ opacity: 0, marginTop: -8 }}
            animate={{ opacity: 1, marginTop: 16 }}
            exit={{ opacity: 0, marginTop: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(!isReply && 'pl-12')}
          >
            <CommentInput
              onSubmit={(text) => handleReplySubmit(text)}
              isLoading={isReplying}
              onCancelReply={() => setShowReplyInput(false)}
              replyTo={comment.id}
              submitLabel="Reply"
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>

      {replies.length > 0 && (
        <div className={cn('mt-3', !isReply && 'pl-12')}>
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
          >
            {showReplies ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                View {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </>
            )}
          </button>
          {showReplies && (
            <div className="mt-3 space-y-2">
              {repliesLoading ? (
                <div className="text-gray-500 text-sm">Loading replies...</div>
              ) : (
                replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    animeId={animeId}
                    episodeId={episodeId}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onLike={onLike}
                    isReply
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
