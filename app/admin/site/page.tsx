'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { SITE_GENERAL_QUERY_KEY } from '@/hooks/useSiteGeneralSettings';
import { MIRROR_SITE_LABEL, MIRROR_SITE_URL } from '@/constants/site';
import { Loader2 } from 'lucide-react';

type SiteSettings = {
  showMirrorLink: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export default function AdminSitePage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <AdminSiteBody getToken={getToken} onForbidden={onForbidden} />;
}

function AdminSiteBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
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
      const res = await fetch('/api/admin/site-settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setSettings(data as SiteSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [getToken, onForbidden]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setShowMirrorLink(next: boolean) {
    setSaving(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) {
        onForbidden();
        return;
      }
      const res = await fetch('/api/admin/site-settings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showMirrorLink: next }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSettings(data as SiteSettings);
      await queryClient.invalidateQueries({ queryKey: SITE_GENERAL_QUERY_KEY });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading site settings…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Site</h1>
        <p className="mt-1 text-sm text-gray-400">
          Public site options. Changes apply on the next page load.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">Mirror link</h2>
        <p className="text-sm text-gray-400">
          Show or hide the{' '}
          <a
            href={MIRROR_SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            {MIRROR_SITE_LABEL}
          </a>{' '}
          link on the home intro and footer.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-800 bg-gray-950/40 p-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={settings.showMirrorLink}
            disabled={saving}
            onChange={(e) => void setShowMirrorLink(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-white">
              Show {MIRROR_SITE_LABEL} link
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">
              Uncheck to hide it site-wide.
            </span>
          </span>
        </label>
        {settings.updatedBy && (
          <p className="text-xs text-gray-500">
            Last change by {settings.updatedBy}
            {settings.updatedAt
              ? ` · ${new Date(settings.updatedAt).toLocaleString()}`
              : ''}
          </p>
        )}
      </section>
    </div>
  );
}
