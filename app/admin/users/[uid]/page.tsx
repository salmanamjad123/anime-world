'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { Loader2 } from 'lucide-react';

type UserDetail = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  lastLogin: string | null;
};

type Stats = {
  watchlistCount: number;
  historyCount: number;
  mangaListCount: number;
  readingHistoryCount: number;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const uid = typeof params.uid === 'string' ? params.uid : '';
  const { getToken, onForbidden } = useAdminAccess();
  return <DetailBody uid={uid} getToken={getToken} onForbidden={onForbidden} />;
}

function DetailBody({
  uid,
  getToken,
  onForbidden,
}: {
  uid: string;
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentHistory, setRecentHistory] = useState<
    {
      animeId: string;
      animeTitle: string;
      episodeId: string | null;
      percentage: number | null;
      completed: boolean;
      lastWatched: string | null;
    }[]
  >([]);
  const [recentWatchlist, setRecentWatchlist] = useState<
    {
      animeId: string;
      title: string;
      status: string;
      addedAt: string | null;
    }[]
  >([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!uid) {
      setError('Missing user id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load user');
      setUser(data.user);
      setStats(data.stats);
      setRecentHistory(data.recentHistory || []);
      setRecentWatchlist(data.recentWatchlist || []);
      setHasData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [uid, getToken, onForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasData && loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading user…
      </p>
    );
  }

  return (
    <div className={`space-y-6 ${loading ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={ROUTES.ADMIN_USERS}
          className="text-sm text-blue-400 hover:underline"
        >
          ← All users
        </Link>
        <Button type="button" variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Refreshing…
            </>
          ) : (
            'Refresh'
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {user && (
        <>
          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 font-medium">Profile</h2>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Email" value={user.email || '—'} />
              <Field label="Display name" value={user.displayName || '—'} />
              <Field label="UID" value={user.uid} mono />
              <Field
                label="OTP verification"
                value={
                  user.emailVerified
                    ? user.emailVerifiedAt
                      ? `Verified via OTP · ${formatDate(user.emailVerifiedAt)}`
                      : 'Verified via OTP'
                    : 'Pending OTP'
                }
              />
              <Field label="Created" value={formatDate(user.createdAt)} />
              <Field label="Last login" value={formatDate(user.lastLogin)} />
            </dl>
          </section>

          {stats && (
            <div className="grid gap-3 sm:grid-cols-4">
              <MiniStat label="Watchlist" value={stats.watchlistCount} />
              <MiniStat label="Watch history" value={stats.historyCount} />
              <MiniStat label="Manga list" value={stats.mangaListCount} />
              <MiniStat label="Reading history" value={stats.readingHistoryCount} />
            </div>
          )}

          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 font-medium">Recent watch history</h2>
            {recentHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No history.</p>
            ) : (
              <ul className="divide-y divide-gray-800 text-sm">
                {recentHistory.map((h) => (
                  <li
                    key={`${h.animeId}-${h.episodeId || 'x'}-${h.lastWatched}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span className="text-gray-200">
                      {h.animeTitle || h.animeId}
                      {h.episodeId ? (
                        <span className="ml-2 text-gray-500">{h.episodeId}</span>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-500">
                      {h.completed
                        ? 'Completed'
                        : h.percentage != null
                          ? `${Math.round(h.percentage)}%`
                          : '—'}{' '}
                      · {formatDate(h.lastWatched)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 font-medium">Recent watchlist</h2>
            {recentWatchlist.length === 0 ? (
              <p className="text-sm text-gray-500">Empty watchlist.</p>
            ) : (
              <ul className="divide-y divide-gray-800 text-sm">
                {recentWatchlist.map((w) => (
                  <li
                    key={w.animeId}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                  >
                    <span className="text-gray-200">{w.title || w.animeId}</span>
                    <span className="text-xs text-gray-500">
                      {w.status} · {formatDate(w.addedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={mono ? 'mt-0.5 break-all font-mono text-xs text-gray-300' : 'mt-0.5 text-gray-200'}>
        {value}
      </dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
