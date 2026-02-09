'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, ArrowUpDown, ChevronDown } from 'lucide-react';
import { useComments } from '@/hooks/useComments';
import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';
import { useUserStore } from '@/store/useUserStore';
import { cn } from '@/lib/utils';
import type { CommentSortBy } from '@/types/comment';
import type { Episode } from '@/types/episode';

interface CommentsSectionProps {
  animeId: string;
  episodeId: string;
  episodes: Episode[];
  onEpisodeChange?: (episodeId: string) => void;
}

const SORT_OPTIONS: { value: CommentSortBy; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'popular', label: 'Popular' },
];

const INITIAL_PAGE_SIZE = 5;
const PAGE_SIZE = 10;

export function CommentsSection({
  animeId,
  episodeId,
  episodes,
  onEpisodeChange,
}: CommentsSectionProps) {
  const { user } = useUserStore();
  const [sortBy, setSortBy] = useState<CommentSortBy>('newest');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(episodeId);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  // Sync selected episode when user navigates to a different episode (prev/next)
  useEffect(() => {
    setSelectedEpisodeId(episodeId);
  }, [episodeId]);

  // Reset pagination when sort or episode changes
  useEffect(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
  }, [sortBy, selectedEpisodeId]);

  const {
    comments,
    totalCount,
    isLoading,
    createComment,
    updateComment,
    deleteComment,
    toggleLike,
    isCreating,
  } = useComments(animeId, selectedEpisodeId, sortBy);

  const handleEpisodeSelect = (epId: string) => {
    setSelectedEpisodeId(epId);
    onEpisodeChange?.(epId);
  };

  const handleSubmitComment = async (text: string, parentId?: string | null) => {
    if (!user) return;
    await createComment({
      animeId,
      episodeId: selectedEpisodeId,
      userId: user.uid,
      displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
      text,
      parentId: parentId ?? null,
    });
  };

  const handleReply = async (text: string, parentId: string) => {
    await handleSubmitComment(text, parentId);
  };

  const handleEdit = async (commentId: string, text: string) => {
    await updateComment({ commentId, text });
  };

  const handleDelete = async (commentId: string) => {
    await deleteComment(commentId);
  };

  const handleLike = (commentId: string, like: boolean) => {
    if (!user) return;
    toggleLike({ commentId, userId: user.uid, like });
  };

  const displayedComments = comments.slice(0, visibleCount);
  const hasMore = comments.length > visibleCount;

  return (
    <section className="bg-gray-800/50 rounded-lg p-3 sm:p-4 md:p-6 lg:h-full lg:flex lg:flex-col">
      <h3 className="text-base sm:text-lg md:text-xl font-bold text-white mb-3 sm:mb-4 flex items-center gap-2 shrink-0">
        <span className="text-blue-500">Comments</span>
      </h3>

      {/* Episode selector + count + Sort by - all in one line */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-nowrap mb-3 sm:mb-4 shrink-0">
        <select
          value={selectedEpisodeId}
          onChange={(e) => handleEpisodeSelect(e.target.value)}
          className="bg-gray-700 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm border border-gray-600 hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-colors shrink-0"
        >
          {episodes.map((ep) => (
            <option key={ep.id} value={ep.id}>
              Episode {ep.number}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1 sm:gap-1.5 text-gray-400 text-xs sm:text-sm shrink-0">
          <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          {totalCount} {totalCount === 1 ? 'Comment' : 'Comments'}
        </span>
        <div className="flex items-center gap-1 sm:gap-2 flex-nowrap ml-auto shrink-0">
          <span className="text-gray-400 text-xs sm:text-sm flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            Sort by
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as CommentSortBy)}
            className="bg-gray-700 text-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm border border-gray-600 hover:border-gray-500 focus:outline-none focus:border-blue-500 transition-colors shrink-0"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comment input - logged-in only */}
      <div className="mb-6">
        <CommentInput
          onSubmit={(text) => handleSubmitComment(text)}
          isLoading={isCreating}
        />
      </div>

      {/* Comment list - flex-1 stretches to fill remaining height on desktop */}
      <div className="divide-y divide-gray-700/50 lg:flex-1 lg:min-h-0">
        {isLoading ? (
          <div className="py-8 text-center text-gray-500">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <>
            {displayedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                animeId={animeId}
                episodeId={selectedEpisodeId}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onLike={handleLike}
              />
            ))}
            {hasMore && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                  View more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
