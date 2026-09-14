'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { Loader2, Swords, Search } from 'lucide-react';

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  gameDemoAccess: boolean;
};

export default function AdminGameDemoPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <GameDemoBody getToken={getToken} onForbidden={onForbidden} />;
}

function GameDemoBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/users?audit=0&limit=0', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(
        (data.users || []).map((u: AdminUser) => ({
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          gameDemoAccess: u.gameDemoAccess === true,
        }))
      );
      setHasData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [getToken, onForbidden]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const grantedCount = useMemo(
    () => users.filter((u) => u.gameDemoAccess).length,
    [users]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'yes' && !u.gameDemoAccess) return false;
      if (filter === 'no' && u.gameDemoAccess) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, query, filter]);

  const toggleAccess = async (user: AdminUser) => {
    setError('');
    setNotice('');
    const next = !user.gameDemoAccess;
    setTogglingUid(user.uid);
    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.uid === user.uid ? { ...u, gameDemoAccess: next } : u))
    );
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/game-demo', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: user.uid, access: next }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setNotice(
        next
          ? `Granted game access to ${user.email || user.uid}.`
          : `Revoked game access for ${user.email || user.uid}.`
      );
    } catch (e) {
      // Revert
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, gameDemoAccess: user.gameDemoAccess } : u
        )
      );
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setTogglingUid(null);
    }
  };

  if (!hasData && loadingUsers) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
      </p>
    );
  }

  return (
    <div className={`space-y-6 ${loadingUsers ? 'opacity-70' : ''}`}>
      <section className="rounded-xl border border-orange-900/40 bg-orange-950/20 p-5">
        <h2 className="flex items-center gap-2 font-medium text-orange-200">
          <Swords className="h-4 w-4" />
          Village Arena — tester access
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Only users with access can see the Game tab and open{' '}
          <code className="text-gray-300">/game</code> after login. Everyone else
          stays on Anime / Manga only while the demo is invite-only.
        </p>
        <p className="mt-3 text-sm text-gray-300">
          <span className="tabular-nums font-semibold text-orange-300">{grantedCount}</span>
          {' '}tester{grantedCount === 1 ? '' : 's'} currently allowed
        </p>
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, name, or uid…"
              className="w-full rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['all', 'All'],
                ['yes', 'Allowed'],
                ['no', 'No access'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === value
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadUsers}
              disabled={loadingUsers}
            >
              {loadingUsers ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  Refreshing…
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mb-3 text-sm text-emerald-400">{notice}</p>}

        <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-gray-800">
          {visible.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No users match.</p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {visible.map((u) => {
                const busy = togglingUid === u.uid;
                return (
                  <li
                    key={u.uid}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-gray-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-200">{u.email || u.uid}</p>
                      {u.displayName ? (
                        <p className="truncate text-xs text-gray-500">{u.displayName}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`text-[10px] uppercase tracking-wide ${
                          u.gameDemoAccess ? 'text-emerald-400' : 'text-gray-600'
                        }`}
                      >
                        {u.gameDemoAccess ? 'Allowed' : 'Blocked'}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={u.gameDemoAccess ? 'ghost' : 'primary'}
                        disabled={busy || !!togglingUid}
                        onClick={() => void toggleAccess(u)}
                        className={
                          u.gameDemoAccess
                            ? 'text-red-300 hover:text-red-200'
                            : 'bg-orange-600 hover:bg-orange-500'
                        }
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : u.gameDemoAccess ? (
                          'Revoke'
                        ) : (
                          'Grant'
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Showing {visible.length} of {users.length} users
        </p>
      </section>
    </div>
  );
}
