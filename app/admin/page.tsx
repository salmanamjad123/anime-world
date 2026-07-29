/**
 * Admin — engagement emails
 * Production: Firebase user in ADMIN_EMAILS
 * Local (NODE_ENV=development): static admin@gmail.com / 12345678
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { auth } from '@/lib/firebase/config';
import { ROUTES } from '@/constants/routes';
import { LOCAL_ADMIN_TOKEN } from '@/lib/admin-constants';
import { Loader2, Mail, ShieldAlert, Users } from 'lucide-react';

type AdminUser = {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

const LOCAL_TOKEN_KEY = 'anime_village_local_admin_token';

function isDev(): boolean {
  return process.env.NODE_ENV === 'development';
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    const local = sessionStorage.getItem(LOCAL_TOKEN_KEY);
    if (local === LOCAL_ADMIN_TOKEN && isDev()) return local;
  }
  const u = auth?.currentUser;
  if (!u) return null;
  return u.getIdToken();
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();

  const [localAuthed, setLocalAuthed] = useState(false);
  const [localEmail, setLocalEmail] = useState('admin@gmail.com');
  const [localPassword, setLocalPassword] = useState('');
  const [localLoginError, setLocalLoginError] = useState('');
  const [localLoggingIn, setLocalLoggingIn] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [configError, setConfigError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendToAll, setSendToAll] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isDev()) return;
    if (sessionStorage.getItem(LOCAL_TOKEN_KEY) === LOCAL_ADMIN_TOKEN) {
      setLocalAuthed(true);
    }
  }, []);

  const canUsePanel = localAuthed || !!user;

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setForbidden(false);
    setConfigError('');
    setError('');
    try {
      const token = await getAuthToken();
      if (!token) {
        setForbidden(true);
        return;
      }
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.status === 403 || res.status === 401) {
        setForbidden(true);
        if (isDev()) {
          sessionStorage.removeItem(LOCAL_TOKEN_KEY);
          setLocalAuthed(false);
        }
        return;
      }
      if (res.status === 503) {
        setConfigError(data.error || 'Admin not configured');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading && !localAuthed) return;
    if (!canUsePanel) return;
    loadUsers();
  }, [authLoading, canUsePanel, localAuthed, loadUsers]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoginError('');
    if (!isDev()) {
      setLocalLoginError('Static admin login is only available in local development.');
      return;
    }
    setLocalLoggingIn(true);
    try {
      const res = await fetch('/api/admin/local-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: localEmail.trim(),
          password: localPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      sessionStorage.setItem(LOCAL_TOKEN_KEY, data.token);
      setLocalAuthed(true);
      setLocalPassword('');
    } catch (err) {
      setLocalLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLocalLoggingIn(false);
    }
  };

  const handleLocalLogout = () => {
    sessionStorage.removeItem(LOCAL_TOKEN_KEY);
    setLocalAuthed(false);
    setUsers([]);
  };

  const allSelected = useMemo(
    () => users.length > 0 && selected.size === users.length,
    [users, selected]
  );

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
      const token = await getAuthToken();
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

  const showLocalLogin = isDev() && !localAuthed && !user && !authLoading;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mail className="h-7 w-7 text-blue-400" />
            <div>
              <h1 className="text-2xl font-semibold">Admin — Engagement email</h1>
              <p className="text-sm text-gray-400">
                Send updates to registered users via Resend
              </p>
            </div>
          </div>
          {localAuthed && isDev() && (
            <Button type="button" variant="ghost" onClick={handleLocalLogout}>
              Log out local admin
            </Button>
          )}
        </div>

        {authLoading && !localAuthed && (
          <p className="flex items-center gap-2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </p>
        )}

        {showLocalLogin && (
          <form
            onSubmit={handleLocalLogin}
            className="mb-6 max-w-md space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6"
          >
            <p className="text-sm text-amber-200/90">
              Local dev admin (not available in production)
            </p>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Email</label>
              <input
                type="email"
                value={localEmail}
                onChange={(e) => setLocalEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-400">Password</label>
              <input
                type="password"
                value={localPassword}
                onChange={(e) => setLocalPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                autoComplete="current-password"
              />
            </div>
            {localLoginError && (
              <p className="text-sm text-red-400">{localLoginError}</p>
            )}
            <Button type="submit" disabled={localLoggingIn}>
              {localLoggingIn ? 'Logging in…' : 'Log in'}
            </Button>
            <p className="text-xs text-gray-500">
              Or{' '}
              <button
                type="button"
                className="text-blue-400 hover:underline"
                onClick={() => openAuthModal('login')}
              >
                sign in with Firebase
              </button>{' '}
              if your email is in ADMIN_EMAILS.
            </p>
          </form>
        )}

        {!authLoading && !user && !localAuthed && !isDev() && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <p className="mb-4 text-gray-300">Sign in with an admin account to continue.</p>
            <Button onClick={() => openAuthModal('login')}>Sign in</Button>
          </div>
        )}

        {!authLoading && canUsePanel && forbidden && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-800/50 bg-amber-950/30 p-6">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200">Access denied</p>
              <p className="mt-1 text-sm text-amber-200/80">
                Your account is not allowed to use admin.
              </p>
              <Link href={ROUTES.PROFILE} className="mt-3 inline-block text-sm text-blue-400 hover:underline">
                Back to profile
              </Link>
            </div>
          </div>
        )}

        {canUsePanel && configError && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6 text-red-200">
            {configError}
          </div>
        )}

        {canUsePanel && !forbidden && !configError && (
          <div className="space-y-6">
            <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-medium">
                  <Users className="h-4 w-4 text-gray-400" />
                  Users ({users.length})
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={loadUsers}
                  disabled={loadingUsers}
                >
                  {loadingUsers ? 'Refreshing…' : 'Refresh'}
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
        )}
      </main>
    </div>
  );
}
