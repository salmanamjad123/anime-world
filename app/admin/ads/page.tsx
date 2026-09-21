'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ADS_SETTINGS_QUERY_KEY } from '@/hooks/useAdsSettings';
import type { AdPlacementId } from '@/lib/ads-placements';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlacementCatalogItem = {
  id: AdPlacementId;
  label: string;
  page: string;
  path: string;
  format: string;
  units: number;
};

type AdsSettingsResponse = {
  enabled: boolean;
  hideForLoggedInUsers: boolean;
  placements: Record<AdPlacementId, boolean>;
  updatedAt: string | null;
  updatedBy: string | null;
  placementsCatalog: PlacementCatalogItem[];
  counts: {
    activeUnits: number;
    totalUnits: number;
    activePlacements: number;
    totalPlacements: number;
  };
};

type AdminUserRow = {
  uid: string;
  email: string;
  displayName: string;
  adsHidden: boolean;
};

export default function AdminAdsPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <AdminAdsBody getToken={getToken} onForbidden={onForbidden} />;
}

function AdminAdsBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AdsSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userQuery, setUserQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'hidden' | 'shown'>('all');
  const [togglingUid, setTogglingUid] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/ads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSettings(data as AdsSettingsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, onForbidden]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
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
        (data.users || []).map((u: AdminUserRow) => ({
          uid: u.uid,
          email: u.email || '',
          displayName: u.displayName || '',
          adsHidden: u.adsHidden === true,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [getToken, onForbidden]);

  useEffect(() => {
    void loadSettings();
    void loadUsers();
  }, [loadSettings, loadUsers]);

  async function patchSettings(body: Record<string, unknown>) {
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/ads', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSettings(data as AdsSettingsResponse);
      await queryClient.invalidateQueries({ queryKey: ADS_SETTINGS_QUERY_KEY });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleUserAds(user: AdminUserRow) {
    const next = !user.adsHidden;
    setTogglingUid(user.uid);
    setUsers((prev) =>
      prev.map((u) => (u.uid === user.uid ? { ...u, adsHidden: next } : u))
    );
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/ads-user', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid: user.uid, adsHidden: next }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
    } catch (e) {
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, adsHidden: user.adsHidden } : u
        )
      );
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setTogglingUid(null);
    }
  }

  const visibleUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilter === 'hidden' && !u.adsHidden) return false;
      if (userFilter === 'shown' && u.adsHidden) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, userQuery, userFilter]);

  const hiddenUserCount = useMemo(
    () => users.filter((u) => u.adsHidden).length,
    [users]
  );

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading ads settings…
      </div>
    );
  }

  const masterOn = settings.enabled !== false;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Ads</h1>
        <p className="mt-1 text-sm text-gray-400">
          Control Adsterra placements, audience rules, and per-user exemptions.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <h2 className="text-lg font-semibold text-white">Summary</h2>
        <p className="mt-2 text-sm text-gray-300">
          <span className="font-medium text-white">{settings.counts.totalPlacements}</span>{' '}
          placements ·{' '}
          <span className="font-medium text-white">{settings.counts.totalUnits}</span> ad units
          total
          {masterOn ? (
            <>
              {' '}
              ·{' '}
              <span className="font-medium text-emerald-400">
                {settings.counts.activeUnits}
              </span>{' '}
              units active when global ads are on
            </>
          ) : (
            <span className="text-amber-400"> · all hidden (global off)</span>
          )}
        </p>
        {settings.updatedBy && (
          <p className="mt-2 text-xs text-gray-500">
            Last site change by {settings.updatedBy}
            {settings.updatedAt
              ? ` · ${new Date(settings.updatedAt).toLocaleString()}`
              : ''}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4">
        <h2 className="text-lg font-semibold text-white">Global</h2>
        <p className="text-sm text-gray-400">
          Master switch — when off, nothing loads regardless of placement toggles.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={saving || masterOn}
            onClick={() => void patchSettings({ enabled: true })}
          >
            Show all (master on)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || !masterOn}
            onClick={() => void patchSettings({ enabled: false })}
          >
            Hide all (master off)
          </Button>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-800 bg-gray-950/40 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.hideForLoggedInUsers}
            disabled={saving}
            onChange={(e) =>
              void patchSettings({ hideForLoggedInUsers: e.target.checked })
            }
          />
          <span>
            <span className="block text-sm font-medium text-white">
              Hide ads for logged-in users
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Guests still see ads (unless a placement is off or they are on the
              exemption list below).
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Placements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="py-2 pr-3 font-medium">Placement</th>
                <th className="py-2 pr-3 font-medium">Page</th>
                <th className="py-2 pr-3 font-medium">Format</th>
                <th className="py-2 pr-3 font-medium">Units</th>
                <th className="py-2 font-medium text-right">Shown</th>
              </tr>
            </thead>
            <tbody>
              {settings.placementsCatalog.map((row) => {
                const on = settings.placements[row.id] !== false;
                return (
                  <tr key={row.id} className="border-b border-gray-800/80">
                    <td className="py-3 pr-3 text-white">{row.label}</td>
                    <td className="py-3 pr-3 text-gray-400">
                      {row.page}
                      <span className="block text-xs text-gray-600">{row.path}</span>
                    </td>
                    <td className="py-3 pr-3 text-gray-400">{row.format}</td>
                    <td className="py-3 pr-3 text-gray-400">{row.units}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        disabled={saving || !masterOn}
                        title={!masterOn ? 'Turn master on first' : undefined}
                        onClick={() =>
                          void patchSettings({
                            placements: { [row.id]: !on },
                          })
                        }
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                          !masterOn && 'opacity-40 cursor-not-allowed',
                          on
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-gray-700 text-gray-400'
                        )}
                      >
                        {on ? 'On' : 'Off'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Per-user exemptions</h2>
          <p className="mt-1 text-sm text-gray-400">
            Hide ads for specific accounts (e.g. supporters, staff).{' '}
            <span className="text-gray-500">
              {hiddenUserCount} user{hiddenUserCount === 1 ? '' : 's'} with ads hidden.
            </span>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              placeholder="Search email, name, uid…"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-950 py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
            />
          </div>
          <select
            value={userFilter}
            onChange={(e) =>
              setUserFilter(e.target.value as 'all' | 'hidden' | 'shown')
            }
            className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
          >
            <option value="all">All users</option>
            <option value="hidden">Ads hidden</option>
            <option value="shown">Ads shown</option>
          </select>
        </div>
        {loadingUsers ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading users…
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-800 rounded-lg border border-gray-800">
            {visibleUsers.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500">
                No users match.
              </li>
            ) : (
              visibleUsers.slice(0, 80).map((u) => (
                <li
                  key={u.uid}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{u.email || u.uid}</p>
                    {u.displayName && (
                      <p className="text-xs text-gray-500 truncate">{u.displayName}</p>
                    )}
                  </div>
                  <Button
                    variant={u.adsHidden ? 'primary' : 'ghost'}
                    size="sm"
                    disabled={togglingUid === u.uid}
                    onClick={() => void toggleUserAds(u)}
                  >
                    {togglingUid === u.uid ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : u.adsHidden ? (
                      'Show ads'
                    ) : (
                      'Hide ads'
                    )}
                  </Button>
                </li>
              ))
            )}
          </ul>
        )}
        {visibleUsers.length > 80 && (
          <p className="text-xs text-gray-500">Showing first 80 matches — refine search.</p>
        )}
      </section>
    </div>
  );
}
