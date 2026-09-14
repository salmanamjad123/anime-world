'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import { ClipboardList, Loader2, Mail, Users } from 'lucide-react';
import type { ReactNode } from 'react';

type Stats = {
  totalUsers: number;
  verified: number;
  unverified: number;
  recentSignups: number;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminOverviewPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <OverviewBody getToken={getToken} onForbidden={onForbidden} />;
}

function OverviewBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    verified: 0,
    unverified: 0,
    recentSignups: 0,
  });
  const [recent, setRecent] = useState<
    {
      uid: string;
      email: string;
      displayName: string;
      createdAt: string | null;
      emailVerified: boolean;
    }[]
  >([]);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch(
        '/api/admin/users?audit=0&limit=8&sort=createdAt&page=1',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      const s = data.stats || {};
      setTotal(s.totalUsers ?? data.total ?? 0);
      setStats({
        totalUsers: s.totalUsers ?? 0,
        verified: s.verified ?? 0,
        unverified: s.unverified ?? 0,
        recentSignups: s.recentSignups ?? 0,
      });
      setRecent(data.users || []);
      setHasData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, onForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!hasData && loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading overview…
      </p>
    );
  }

  return (
    <div className={`space-y-6 ${loading ? 'opacity-70' : ''}`}>
      <div className="flex justify-end">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={String(total)} />
        <StatCard label="OTP verified" value={String(stats.verified)} />
        <StatCard label="Unverified" value={String(stats.unverified)} />
        <StatCard label="Signups (7 days)" value={String(stats.recentSignups)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          href={ROUTES.ADMIN_USERS}
          icon={<Users className="h-4 w-4" />}
          label="Browse users"
        />
        <QuickLink
          href={ROUTES.ADMIN_AUDITS}
          icon={<ClipboardList className="h-4 w-4" />}
          label="View audits"
        />
        <QuickLink
          href={ROUTES.ADMIN_EMAIL}
          icon={<Mail className="h-4 w-4" />}
          label="Send email"
        />
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="mb-3 font-medium">Recent signups</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">No users yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {recent.map((u) => (
              <li key={u.uid}>
                <Link
                  href={ROUTES.ADMIN_USER(u.uid)}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-blue-300"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-gray-200">{u.email || u.uid}</span>
                    {u.displayName ? (
                      <span className="ml-2 text-gray-500">{u.displayName}</span>
                    ) : null}
                    {u.emailVerified ? (
                      <span className="ml-2 text-[10px] uppercase text-emerald-500">
                        OTP
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] uppercase text-amber-500">
                        Pending
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {formatDate(u.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-sm text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-900"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  );
}
