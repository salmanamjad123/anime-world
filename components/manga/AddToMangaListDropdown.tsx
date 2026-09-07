/**
 * Add to Manga List Dropdown
 * MAL-style list options with manga-specific labels and amber theme
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Check, ChevronDown } from 'lucide-react';
import type { ListStatus } from '@/types';
import { cn } from '@/lib/utils';

const LIST_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: 'watching', label: 'Reading' },
  { value: 'on-hold', label: 'On-Hold' },
  { value: 'plan-to-watch', label: 'Plan to read' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'completed', label: 'Completed' },
];

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2',
} as const;

interface AddToMangaListDropdownProps {
  currentStatus: ListStatus | null;
  onSelect: (status: ListStatus) => void;
  onRemove?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function AddToMangaListDropdown({
  currentStatus,
  onSelect,
  onRemove,
  disabled,
  loading,
  className,
  size = 'md',
}: AddToMangaListDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonLabel = currentStatus
    ? LIST_OPTIONS.find((o) => o.value === currentStatus)?.label ?? 'In List'
    : 'Add to List';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-colors w-full',
          'bg-gray-600 border border-gray-500 hover:bg-gray-500 hover:border-gray-400',
          'text-white hover:bg-gray-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          SIZE_CLASSES[size]
        )}
      >
        {loading ? (
          <span className={cn('inline-block bg-white/30 rounded animate-pulse', size === 'lg' ? 'h-5 w-28' : 'h-4 w-24')} aria-hidden />
        ) : (
          <>
            <Plus className={cn('shrink-0', size === 'lg' ? 'w-5 h-5' : 'w-4 h-4')} />
            {buttonLabel}
            <ChevronDown
              className={cn('shrink-0 transition-transform', size === 'lg' ? 'w-5 h-5' : 'w-4 h-4', open && 'rotate-180')}
            />
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-48 py-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl z-50">
          {LIST_OPTIONS.map((opt) => {
            const isSelected = currentStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onSelect(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors',
                  isSelected ? 'text-amber-400 bg-amber-500/10' : 'text-gray-200 hover:bg-gray-700'
                )}
              >
                {isSelected ? (
                  <Check className="w-4 h-4 shrink-0 text-amber-400" />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                {opt.label}
              </button>
            );
          })}
          {currentStatus && onRemove && (
            <>
              <div className="my-1 border-t border-gray-700" />
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  setOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-gray-700"
              >
                Remove from list
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
