'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface CommentInputProps {
  onSubmit: (text: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  replyTo?: string | null;
  onCancelReply?: () => void;
  /** Button label: "Comment" for top-level, "Reply" when replying */
  submitLabel?: 'Comment' | 'Reply';
  /** Compact mode: smaller avatar, fewer rows, for reply input */
  compact?: boolean;
  className?: string;
}

export function CommentInput({
  onSubmit,
  isLoading,
  placeholder = 'Leave a comment.',
  replyTo,
  onCancelReply,
  submitLabel = 'Comment',
  compact = false,
  className,
}: CommentInputProps) {
  const { user } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (!user) {
      openAuthModal('login');
      return;
    }

    await onSubmit(trimmed);
    setText('');
  };

  if (!user) {
    return (
      <div
        className={cn(
          'rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-center',
          className
        )}
      >
        <p className="text-gray-400 text-sm">
          Log in to join the conversation and leave a comment.
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={() => openAuthModal('login')}
        >
          Log in
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex gap-3 overflow-hidden transition-all duration-200 ease-out',
        compact ? 'gap-2' : '',
        className
      )}
    >
      <div className={cn('shrink-0', compact ? 'pt-0.5' : '')}>
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt=""
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            className="rounded-full object-cover"
          />
        ) : (
          <div
            className={cn(
              'rounded-full bg-gray-600 flex items-center justify-center text-gray-400 font-medium',
              compact ? 'h-8 w-8 text-sm' : 'h-10 w-10'
            )}
          >
            {(user.displayName || user.email || '?')[0].toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {!compact && (
          <p className="text-gray-400 text-xs mb-1">
            Comment as {user.displayName || user.email?.split('@')[0] || 'Anonymous'}
          </p>
        )}
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={compact ? 'Add a reply' : placeholder}
            disabled={isLoading}
            rows={compact ? 2 : 3}
            className={cn(
              'w-full bg-gray-700 text-white placeholder-gray-500 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none',
              compact ? 'px-3 py-2 pr-24 text-sm' : 'px-4 py-3 pr-12'
            )}
            aria-label={compact ? 'Reply' : 'Comment'}
          />
          <div className={cn('absolute flex items-center gap-2', compact ? 'bottom-2 right-2' : 'bottom-3 right-3')}>
            {replyTo && onCancelReply && (
              <button
                type="button"
                onClick={onCancelReply}
                className="text-gray-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isLoading}
              disabled={!text.trim()}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
