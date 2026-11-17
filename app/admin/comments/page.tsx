'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';

type AdminComment = {
  id: string;
  path: string;
  animeId: string;
  episodeId: string;
  userId: string;
  displayName: string;
  text: string;
  parentId: string | null;
  likes: number;
  createdAt: string | null;
  animeTitle: string | null;
  watchPath: string;
};

const PAGE_SIZE = 15;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function episodeLabel(episodeId: string): string {
  const decoded = decodeURIComponent(episodeId);
  const ep = decoded.match(/[?&]ep=(\d+)/)?.[1];
  const slug = decoded.split('?')[0];
  const short = slug.length > 48 ? `${slug.slice(0, 45)}…` : slug;
  return ep ? `${short} (ep ${ep})` : short;
}

export default function AdminCommentsPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <CommentsBody getToken={getToken} onForbidden={onForbidden} />;
}

function CommentsBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      setError('');
      try {
        const token = await getToken();
        if (!token) {
          onForbidden();
          return;
        }
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursor) params.set('cursor', cursor);
        const res = await fetch(`/api/admin/comments?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.status === 401 || res.status === 403) {
          onForbidden();
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Failed to load comments');
        setComments(data.comments || []);
        setNextCursor(data.nextCursor ?? null);
        setHasMore(Boolean(data.hasMore));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    },
    [getToken, onForbidden]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const goNext = async () => {
    if (!hasMore || !nextCursor) return;
    const nextIndex = pageIndex + 1;
    setCursorStack((prev) => {
      const copy = prev.slice(0, nextIndex);
      copy[nextIndex] = nextCursor;
      return copy;
    });
    setPageIndex(nextIndex);
    await load(nextCursor);
  };

  const goPrev = async () => {
    if (pageIndex <= 0) return;
    const prevIndex = pageIndex - 1;
    const cursor = cursorStack[prevIndex] ?? null;
    setPageIndex(prevIndex);
    await load(cursor);
  };

  if (loading && comments.length === 0 && !error) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${loading ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Comments</h1>
          <p className="text-sm text-gray-500">
            Latest episode comments across the site · {PAGE_SIZE} per page
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || pageIndex <= 0}
            onClick={() => void goPrev()}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-gray-500">Page {pageIndex + 1}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || !hasMore}
            onClick={() => void goNext()}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {comments.length === 0 && !loading ? (
        <p className="text-sm text-gray-500">No comments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Comment</th>
                <th className="px-3 py-2 font-medium">Anime / episode</th>
                <th className="px-3 py-2 font-medium text-right">Link</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.path} className="border-b border-gray-800/80 align-top">
                  <td className="whitespace-nowrap px-3 py-3 text-gray-400">
                    {formatDate(c.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-white">{c.displayName}</div>
                    <div className="text-xs text-gray-600">{c.userId.slice(0, 10)}…</div>
                  </td>
                  <td className="px-3 py-3 text-gray-300">
                    {c.parentId && (
                      <span className="mb-1 mr-2 inline-block rounded bg-gray-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                        Reply
                      </span>
                    )}
                    <p className="max-w-md whitespace-pre-wrap break-words">{c.text}</p>
                    {c.likes > 0 && (
                      <p className="mt-1 text-xs text-gray-600">{c.likes} likes</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-white">
                      {c.animeTitle || `Anime #${c.animeId}`}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {episodeLabel(c.episodeId)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={c.watchPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
