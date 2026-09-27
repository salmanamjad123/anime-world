'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { MangaChapter } from '@/types';
import { cn } from '@/lib/utils';

function isRedundantChapterTitle(title: string | undefined, chapter?: string): boolean {
  if (!title?.trim()) return true;
  const compact = title.replace(/\s+/g, '').toLowerCase();
  if (/^ch\.?\d+(\.\d+)?$/.test(compact) || /^chapter\d+(\.\d+)?$/.test(compact)) {
    return true;
  }
  if (chapter) {
    return (
      compact === `ch.${chapter}` ||
      compact === `ch${chapter}` ||
      compact === `chapter${chapter}`
    );
  }
  return false;
}

export function chapterSelectLabel(chapter?: MangaChapter | null, fallback?: string): string {
  if (chapter?.chapter) return `Ch. ${chapter.chapter}`;
  if (chapter?.title) {
    const stripped = chapter.title.replace(/^ch(?:apter)?\.?\s*/i, '').trim();
    return stripped ? `Ch. ${stripped}` : fallback || 'Chapter';
  }
  return fallback || 'Chapters';
}

export function chapterLabelFromId(chapterId?: string | null): string | undefined {
  if (!chapterId) return undefined;
  const match = chapterId.match(/(?:^|[/_-])c0*(\d+(?:\.\d+)?)(?:$|[/_-])/i);
  return match ? `Ch. ${match[1]}` : undefined;
}

function chapterTitleExtra(chapter: MangaChapter): string | null {
  if (isRedundantChapterTitle(chapter.title, chapter.chapter)) return null;
  return chapter.title?.trim() || null;
}

interface MangaChapterSelectProps {
  chapters: MangaChapter[];
  currentId: string | null;
  onSelect: (chapter: MangaChapter) => void;
  isRead?: (chapterId: string) => boolean;
  pageLabel?: string;
  fallbackLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function MangaChapterSelect({
  chapters,
  currentId,
  onSelect,
  isRead,
  pageLabel,
  fallbackLabel,
  disabled,
  className,
}: MangaChapterSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = chapters.find((c) => c.id === currentId) ?? null;
  const showSearch = chapters.length > 12;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) => {
      const num = c.chapter?.toLowerCase() ?? '';
      const title = c.title?.toLowerCase() ?? '';
      return num.includes(q) || title.includes(q) || `ch. ${num}`.includes(q);
    });
  }, [chapters, query]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isMobile = vw < 640;
    const width = isMobile ? Math.min(vw - gutter * 2, 420) : 320;
    const left = isMobile
      ? Math.max(gutter, (vw - width) / 2)
      : Math.min(Math.max(gutter, rect.left + rect.width / 2 - width / 2), vw - width - gutter);
    const spaceBelow = vh - rect.bottom - gutter;
    const maxHeight = Math.max(180, Math.min(isMobile ? vh * 0.62 : 420, spaceBelow));

    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left,
      width,
      maxHeight,
      zIndex: 80,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    currentItemRef.current?.scrollIntoView({ block: 'center' });
    if (showSearch && window.matchMedia('(min-width: 640px)').matches) {
      searchRef.current?.focus();
    }
  }, [open, showSearch, currentId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const handleSelect = (chapter: MangaChapter) => {
    setOpen(false);
    if (chapter.id !== currentId) onSelect(chapter);
  };

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || chapters.length === 0}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose chapter"
        className={cn(
          'flex w-full min-h-[40px] sm:min-h-[40px] items-center justify-center gap-1 px-1.5 sm:px-2',
          'text-sm text-gray-200 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed',
          'rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
        )}
      >
        <span className="truncate font-medium tabular-nums">
          {chapterSelectLabel(current, fallbackLabel)}
        </span>
        {pageLabel && (
          <span className="shrink-0 text-gray-500 tabular-nums">
            · {pageLabel}
          </span>
        )}
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 text-white transition-transform', open && 'rotate-180')}
        />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Chapters"
            style={panelStyle}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900/98 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-3 py-2">
              <p className="text-xs font-medium text-gray-400">
                {chapters.length === 1 ? '1 chapter' : `${chapters.length} chapters`}
              </p>
              {current && (
                <p className="truncate text-xs text-amber-400">{chapterSelectLabel(current)}</p>
              )}
            </div>
            {showSearch && (
              <div className="border-b border-gray-800 px-2 py-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Jump to chapter…"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-8 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </label>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No matching chapters</p>
              ) : (
                filtered.map((chapter) => {
                  const selected = chapter.id === currentId;
                  const read = isRead?.(chapter.id) ?? false;
                  const extra = chapterTitleExtra(chapter);
                  return (
                    <button
                      key={chapter.id}
                      ref={selected ? currentItemRef : undefined}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(chapter)}
                      className={cn(
                        'flex w-full min-h-[44px] items-start gap-2 px-3 py-2 text-left transition-colors',
                        selected
                          ? 'bg-amber-600/20 text-amber-200'
                          : read
                            ? 'text-gray-500 hover:bg-gray-800'
                            : 'text-gray-200 hover:bg-gray-800'
                      )}
                    >
                      {selected ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      ) : (
                        <span className="mt-0.5 w-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium tabular-nums">
                          {chapterSelectLabel(chapter)}
                        </span>
                        {extra && (
                          <span className="mt-0.5 block truncate text-xs text-gray-500">{extra}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
