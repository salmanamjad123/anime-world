'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { useUserStore } from '@/store/useUserStore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import { ROUTES } from '@/constants/routes';
import {
  LOCAL_ADMIN_TOKEN_KEY,
  clearLocalAdminSession,
  getAdminAuthToken,
  hasLocalAdminSession,
  isAdminDev,
} from '@/lib/admin-auth-client';
import { AdminNav } from '@/components/admin/AdminNav';
import { Loader2, ShieldAlert } from 'lucide-react';

type GateState = 'loading' | 'login' | 'forbidden' | 'config' | 'ready';

type AdminAccessValue = {
  getToken: () => Promise<string | null>;
  onForbidden: () => void;
  ready: boolean;
};

const AdminAccessContext = createContext<AdminAccessValue | null>(null);

export function useAdminAccess(): AdminAccessValue {
  const ctx = useContext(AdminAccessContext);
  if (!ctx) {
    throw new Error('useAdminAccess must be used within AdminShell');
  }
  return ctx;
}

const PAGE_META: Record<string, { title: string; description?: string }> = {
  [ROUTES.ADMIN]: {
    title: 'Admin',
    description:
      'Users, audits, and engagement tools. Audits older than 15 days are purged automatically.',
  },
  [ROUTES.ADMIN_USERS]: {
    title: 'Users',
    description: 'Registered accounts. Verified = completed email OTP.',
  },
  [ROUTES.ADMIN_AUDITS]: {
    title: 'Audits',
    description:
      'Admin actions are logged here. Entries older than 15 days are deleted by a daily cron.',
  },
  [ROUTES.ADMIN_EMAIL]: {
    title: 'Engagement email',
    description: 'Send updates to registered users via Resend.',
  },
};

function resolveMeta(pathname: string): { title: string; description?: string } {
  if (pathname.startsWith(`${ROUTES.ADMIN_USERS}/`)) {
    const uid = pathname.slice(`${ROUTES.ADMIN_USERS}/`.length);
    return { title: 'User detail', description: decodeURIComponent(uid) || undefined };
  }
  return PAGE_META[pathname] || { title: 'Admin' };
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const meta = resolveMeta(pathname);
  const { user, isLoading: authLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();

  const [localAuthed, setLocalAuthed] = useState(false);
  const [localEmail, setLocalEmail] = useState('admin@gmail.com');
  const [localPassword, setLocalPassword] = useState('');
  const [localLoginError, setLocalLoginError] = useState('');
  const [localLoggingIn, setLocalLoggingIn] = useState(false);
  const [state, setState] = useState<GateState>('loading');
  const [configError, setConfigError] = useState('');
  const [probedOnce, setProbedOnce] = useState(false);

  useEffect(() => {
    if (hasLocalAdminSession()) setLocalAuthed(true);
  }, []);

  const canAttempt = localAuthed || !!user;

  const probeAccess = useCallback(async () => {
    // Only show full-screen loading on the first probe
    if (!probedOnce) setState('loading');
    setConfigError('');
    const token = await getAdminAuthToken();
    if (!token) {
      setState(localAuthed || user ? 'forbidden' : 'login');
      setProbedOnce(true);
      return;
    }
    try {
      const res = await fetch('/api/admin/users?audit=0&limit=1', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        clearLocalAdminSession();
        setLocalAuthed(false);
        setState('forbidden');
        setProbedOnce(true);
        return;
      }
      if (res.status === 503) {
        setConfigError(data.error || 'Admin not configured');
        setState('config');
        setProbedOnce(true);
        return;
      }
      if (!res.ok) {
        setConfigError(data.error || 'Failed to verify admin access');
        setState('config');
        setProbedOnce(true);
        return;
      }
      setState('ready');
      setProbedOnce(true);
    } catch {
      setConfigError('Failed to verify admin access');
      setState('config');
      setProbedOnce(true);
    }
  }, [localAuthed, user, probedOnce]);

  useEffect(() => {
    if (authLoading && !localAuthed) {
      if (!probedOnce) setState('loading');
      return;
    }
    if (!canAttempt) {
      setState('login');
      setProbedOnce(true);
      return;
    }
    // Re-probe only when auth identity changes, not on every tab
    void probeAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: probe on auth change only
  }, [authLoading, canAttempt, localAuthed, user?.uid]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoginError('');
    if (!isAdminDev()) {
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
      sessionStorage.setItem(LOCAL_ADMIN_TOKEN_KEY, data.token);
      setLocalAuthed(true);
      setLocalPassword('');
      setProbedOnce(false);
    } catch (err) {
      setLocalLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLocalLoggingIn(false);
    }
  };

  const handleLocalLogout = () => {
    clearLocalAdminSession();
    setLocalAuthed(false);
    setState('login');
    setProbedOnce(true);
  };

  const onForbidden = useCallback(() => {
    clearLocalAdminSession();
    setLocalAuthed(false);
    setState('forbidden');
  }, []);

  const accessValue = useMemo<AdminAccessValue>(
    () => ({
      getToken: getAdminAuthToken,
      onForbidden,
      ready: state === 'ready',
    }),
    [onForbidden, state]
  );

  const showLocalLogin = isAdminDev() && state === 'login';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{meta.title}</h1>
            {meta.description ? (
              <p className="mt-1 text-sm text-gray-400">{meta.description}</p>
            ) : null}
          </div>
          {localAuthed && isAdminDev() && state === 'ready' && (
            <Button type="button" variant="ghost" size="sm" onClick={handleLocalLogout}>
              Log out local admin
            </Button>
          )}
        </div>

        {(state === 'ready' || probedOnce) && state !== 'login' && state !== 'forbidden' && (
          <AdminNav className="mb-6" />
        )}

        {state === 'loading' && !probedOnce && (
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

        {!isAdminDev() && state === 'login' && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-6">
            <p className="mb-4 text-gray-300">Sign in with an admin account to continue.</p>
            <Button onClick={() => openAuthModal('login')}>Sign in</Button>
          </div>
        )}

        {state === 'forbidden' && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-800/50 bg-amber-950/30 p-6">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-medium text-amber-200">Access denied</p>
              <p className="mt-1 text-sm text-amber-200/80">
                Your account is not allowed to use admin.
              </p>
              <Link
                href={ROUTES.PROFILE}
                className="mt-3 inline-block text-sm text-blue-400 hover:underline"
              >
                Back to profile
              </Link>
            </div>
          </div>
        )}

        {state === 'config' && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-6 text-red-200">
            {configError || 'Admin not configured'}
          </div>
        )}

        {state === 'ready' && (
          <AdminAccessContext.Provider value={accessValue}>
            {children}
          </AdminAccessContext.Provider>
        )}
      </main>
    </div>
  );
}
