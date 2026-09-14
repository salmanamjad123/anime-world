'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminAccess } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/Button';
import { Loader2, Users } from 'lucide-react';

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
};

export default function AdminEmailPage() {
  const { getToken, onForbidden } = useAdminAccess();
  return <EmailBody getToken={getToken} onForbidden={onForbidden} />;
}

function EmailBody({
  getToken,
  onForbidden,
}: {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hasData, setHasData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendToAll, setSendToAll] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

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
      setUsers(data.users || []);
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

  const allSelected = useMemo(
    () => users.length > 0 && selected.size === users.length,
    [users, selected]
  );

  if (!hasData && loadingUsers) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading recipients…
      </p>
    );
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map((u) => u.uid)));
  };

  const toggleOne = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    setError('');
    setResult('');
    if (!subject.trim() || !body.trim()) {
      setError('Subject and message are required.');
      return;
    }
    if (!sendToAll && selected.size === 0) {
      setError('Select at least one user, or choose Send to all.');
      return;
    }

    const count = sendToAll ? users.length : selected.size;
    if (
      !window.confirm(
        `Send this email to ${count} user${count === 1 ? '' : 's'}?`
      )
    ) {
      return;
    }

    setSending(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          sendToAll,
          uids: sendToAll ? [] : Array.from(selected),
        }),
      });
      const data = await res.json();
      if (res.status === 401 || res.status === 403) {
        onForbidden();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Send failed');
      setResult(
        `Sent ${data.sent} of ${data.total}${data.failed ? ` (${data.failed} failed)` : ''}.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`space-y-6 ${loadingUsers ? 'opacity-70' : ''}`}>
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium">
            <Users className="h-4 w-4 text-gray-400" />
            Recipients ({users.length})
          </h2>
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

        <label className="mb-3 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={sendToAll}
            onChange={(e) => setSendToAll(e.target.checked)}
            className="rounded border-gray-600"
          />
          Send to all users (ignores selection)
        </label>

        {!sendToAll && (
          <>
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="rounded border-gray-600"
              />
              Select all
            </label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-800">
              {loadingUsers ? (
                <p className="p-4 text-sm text-gray-500">Loading users…</p>
              ) : users.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">No users in Firestore.</p>
              ) : (
                <ul className="divide-y divide-gray-800">
                  {users.map((u) => (
                    <li key={u.uid}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-800/50">
                        <input
                          type="checkbox"
                          checked={selected.has(u.uid)}
                          onChange={() => toggleOne(u.uid)}
                          className="rounded border-gray-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <span className="text-gray-200">{u.email}</span>
                          {u.displayName ? (
                            <span className="ml-2 text-gray-500">{u.displayName}</span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {selected.size} selected · max 100 per send
            </p>
          </>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="font-medium">Compose</h2>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="What's new on Anime Village"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={10000}
            rows={8}
            placeholder="Write your engagement message…"
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && <p className="text-sm text-emerald-400">{result}</p>}

        <Button onClick={handleSend} disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            'Send email'
          )}
        </Button>
      </section>
    </div>
  );
}
