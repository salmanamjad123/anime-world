'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  lastLogin: string | null;
};

type Stats = {
  totalUsers: number;
  verified: number;
  unverified: number;
  recentSignups: number;
};

type VerifiedFilter = 'all' | 'yes' | 'no';

const PAGE_SIZE = 20;

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

export default function AdminUsersPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <UsersBody getToken={getToken} onForbidden={onForbidden} />;
}

function UsersBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    verified: 0,
    unverified: 0,
    recentSignups: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [verified, setVerified] = useState<VerifiedFilter>('all');
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, verified]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: 'createdAt',
        verified,
      });
      if (qDebounced) params.set('q', qDebounced);

      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.users || []);
      setFilteredTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (data.stats) {
        setStats({
          totalUsers: data.stats.totalUsers ?? 0,
          verified: data.stats.verified ?? 0,
          unverified: data.stats.unverified ?? 0,
          recentSignups: data.stats.recentSignups ?? 0,
        });
      }
      if (typeof data.page === 'number' && data.page !== page) {
        setPage(data.page);
      }
      setHasData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [getToken, onForbidden, page, qDebounced, verified]);

  useEffect(() => {
    void load();
  }, [load]);

  const from = filteredTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filteredTotal);

  if (!hasData && loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${loading ? 'opacity-70' : ''}`}>
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat label="Total available" value={stats.totalUsers} />
        <MiniStat label="OTP verified" value={stats.verified} accent="emerald" />
        <MiniStat label="Unverified" value={stats.unverified} accent="amber" />
        <MiniStat label="Signups (7d)" value={stats.recentSignups} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name, or uid…"
          className="min-w-[200px] flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <select
          value={verified}
          onChange={(e) => setVerified(e.target.value as VerifiedFilter)}
          className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          aria-label="Verification filter"
        >
          <option value="all">All verification</option>
          <option value="yes">OTP verified</option>
          <option value="no">Unverified</option>
        </select>
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

      <p className="text-xs text-gray-500">
        {filteredTotal === 0
          ? 'No users match'
          : `Showing ${from}–${to} of ${filteredTotal} matched`}
        {qDebounced || verified !== 'all'
          ? ` · ${stats.totalUsers} total available`
          : null}
      </p>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-900/80 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">OTP verified</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-900/40">
                  <td className="px-3 py-2.5">
                    <Link
                      href={ROUTES.ADMIN_USER(u.uid)}
                      className="text-blue-400 hover:underline"
                    >
                      {u.email || u.uid}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-gray-300">{u.displayName || '—'}</td>
                  <td className="px-3 py-2.5">
                    {u.emailVerified ? (
                      <div>
                        <span className="inline-flex rounded-md bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-400">
                          OTP verified
                        </span>
                        {u.emailVerifiedAt ? (
                          <p className="mt-1 text-[11px] text-gray-500">
                            {formatDate(u.emailVerifiedAt)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="inline-flex rounded-md bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-400/90">
                        Pending OTP
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{formatDate(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-gray-400">{formatDate(u.lastLogin)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'emerald' | 'amber';
}) {
  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'amber'
        ? 'text-amber-400'
        : 'text-white';
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
