'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { ADS_ENABLED_QUERY_KEY } from '@/hooks/useAdsEnabled';
import { Loader2 } from 'lucide-react';

type AdsSettings = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
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
  const [settings, setSettings] = useState<AdsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const res = await fetch('/api/admin/ads', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSettings({
        enabled: data.enabled !== false,
        updatedAt: data.updatedAt ?? null,
        updatedBy: data.updatedBy ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, onForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setEnabled(enabled: boolean) {
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
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSettings({
        enabled: data.enabled !== false,
        updatedAt: data.updatedAt ?? null,
        updatedBy: data.updatedBy ?? null,
      });
      await queryClient.invalidateQueries({ queryKey: ADS_ENABLED_QUERY_KEY });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading ads settings…
      </div>
    );
  }

  const enabled = settings?.enabled !== false;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Ads</h1>
        <p className="mt-1 text-sm text-gray-400">
          Show or hide Adsterra banners and smartlinks site-wide. When off, ad slots
          are not loaded.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
        <p className="text-sm font-medium text-white">
          Status:{' '}
          <span className={enabled ? 'text-emerald-400' : 'text-amber-400'}>
            {enabled ? 'Showing ads' : 'Hidden'}
          </span>
        </p>
        {settings?.updatedBy && (
          <p className="mt-2 text-xs text-gray-500">
            Last changed by {settings.updatedBy}
            {settings.updatedAt
              ? ` · ${new Date(settings.updatedAt).toLocaleString()}`
              : ''}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={saving || enabled}
            onClick={() => void setEnabled(true)}
          >
            Show ads
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || !enabled}
            onClick={() => void setEnabled(false)}
          >
            Hide ads
          </Button>
        </div>
      </div>
    </div>
  );
}
