'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/constants/routes';
import type { AdminAuditEntry } from '@/lib/admin-audit';
import { Loader2 } from 'lucide-react';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function AdminAuditsPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <AuditsBody getToken={getToken} onForbidden={onForbidden} />;
}

function AuditsBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [audits, setAudits] = useState<AdminAuditEntry[]>([]);
  const [retentionDays, setRetentionDays] = useState(15);
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
      const res = await fetch('/api/admin/audits?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load audits');
      setAudits(data.audits || []);
      if (typeof data.retentionDays === 'number') {
        setRetentionDays(data.retentionDays);
      }
      setHasData(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load audits');
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading audits…
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${loading ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Retention: {retentionDays} days · showing latest {audits.length}
        </p>
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

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-900/80 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {audits.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-gray-500">
                  No audit entries yet. Viewing users or sending email will create logs.
                </td>
              </tr>
            ) : (
              audits.map((a) => (
                <tr key={a.id} className="align-top hover:bg-gray-900/40">
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-400">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-blue-300">
                    {a.action}
                  </td>
                  <td className="px-3 py-2.5 text-gray-300">
                    {a.actorEmail || a.actorUid}
                  </td>
                  <td className="px-3 py-2.5">
                    {a.targetUid ? (
                      <Link
                        href={ROUTES.ADMIN_USER(a.targetUid)}
                        className="font-mono text-xs text-blue-400 hover:underline"
                      >
                        {a.targetUid.slice(0, 12)}…
                      </Link>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="max-w-xs px-3 py-2.5 font-mono text-[11px] text-gray-500">
                    {a.meta ? JSON.stringify(a.meta) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
