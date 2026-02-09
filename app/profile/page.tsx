/**
 * Profile Page
 * Top-level tabs: Profile | Continue Watching | Watch List
 * Sub-tabs for Watch List: All | Watching | On-Hold | Plan to watch | Dropped | Completed
 */

'use client';

import { Header } from '@/components/layout/Header';
import { useUserStore } from '@/store/useUserStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useMemo, useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Input } from '@/components/ui/Input';
import { User, History, Heart, ShieldAlert, Lock, Pencil, Trash2, MoreVertical, Check, Play, Loader2 } from 'lucide-react';
import { updateUserDisplayName } from '@/lib/firebase/auth';
import { auth } from '@/lib/firebase/config';
import { clearWatchHistory, removeFromWatchHistory, setListItem as setListItemDb, removeFromWatchlist as removeFromWatchlistDb } from '@/lib/firebase/firestore';
import { useAuthModalStore } from '@/store/useAuthModalStore';
import type { ListStatus } from '@/types';

type Section = 'profile' | 'watching' | 'watchlist';

const SUB_TABS: { key: 'all' | ListStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watching', label: 'Watching' },
  { key: 'on-hold', label: 'On-Hold' },
  { key: 'plan-to-watch', label: 'Plan to watch' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'completed', label: 'Completed' },
];

const LIST_TABS: { key: ListStatus; label: string }[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'on-hold', label: 'On-Hold' },
  { key: 'plan-to-watch', label: 'Plan to watch' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'completed', label: 'Completed' },
];

const TOP_TABS: { key: Section; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'watching', label: 'Continue Watching', icon: History },
  { key: 'watchlist', label: 'Watch List', icon: Heart },
];

const LIST_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'on-hold', label: 'On-Hold' },
  { value: 'plan-to-watch', label: 'Plan to watch' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'completed', label: 'Completed' },
];

function WatchListCard({
  item,
  onStatusChange,
  onRemove,
}: {
  item: { animeId: string; title: string; image: string; addedAt: Date; status?: ListStatus };
  onStatusChange: (status: ListStatus) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentStatus = item.status || 'plan-to-watch';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative group bg-gray-800 rounded-lg overflow-visible hover:ring-2 hover:ring-blue-500 transition-all">
      <Link href={ROUTES.ANIME_DETAIL(item.animeId)} className="block overflow-hidden rounded-lg">
        <div className="relative aspect-[2/3] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((o) => !o);
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-900/80 hover:bg-gray-800 flex items-center justify-center text-white transition-colors"
            aria-label="Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm text-white line-clamp-2">{item.title}</h3>
          <p className="text-xs text-gray-400 mt-1">Added {item.addedAt.toLocaleDateString()}</p>
        </div>
      </Link>
      {open && (
        <div className="absolute top-10 left-2 right-2 sm:left-auto sm:right-2 sm:w-44 z-50 py-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl min-w-[10rem]">
          {LIST_OPTIONS.map((opt) => {
            const isSelected = currentStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onStatusChange(opt.value);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-gray-700 text-gray-200"
              >
                {isSelected ? <Check className="w-4 h-4 text-blue-400 shrink-0" /> : <span className="w-4 shrink-0" />}
                {opt.label}
              </button>
            );
          })}
          <div className="my-1 border-t border-gray-700" />
          <button
            type="button"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
          >
            Remove from list
          </button>
        </div>
      )}
    </div>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const tabParam = searchParams.get('tab');

  // Map legacy ?tab= to section (backward compatibility)
  const activeSection: Section = (() => {
    if (sectionParam === 'profile' || sectionParam === 'watching' || sectionParam === 'watchlist') {
      return sectionParam;
    }
    if (tabParam === 'watching') return 'watching';
    if (tabParam && SUB_TABS.some((t) => t.key === tabParam)) return 'watchlist';
    return 'profile';
  })();

  const activeSubTab: 'all' | ListStatus =
    activeSection === 'watchlist' && tabParam && SUB_TABS.some((t) => t.key === tabParam)
      ? (tabParam as 'all' | ListStatus)
      : 'all';

  const setSection = (s: Section) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', s);
    if (s === 'watchlist') params.set('tab', 'all');
    else params.delete('tab');
    router.replace(`${ROUTES.PROFILE}?${params.toString()}`, { scroll: false });
  };

  const setSubTab = (t: 'all' | ListStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', 'watchlist');
    params.set('tab', t);
    router.replace(`${ROUTES.PROFILE}?${params.toString()}`, { scroll: false });
  };

  const { user, isLoading } = useUserStore();
  const { openAuthModal } = useAuthModalStore();
  const { watchlist, getItemsByStatus, setListStatus, removeFromList } = useWatchlistStore();
  const { history, removeFromHistory, clearHistory } = useHistoryStore();

  useEffect(() => {
    if (!user && !isLoading) router.replace(ROUTES.HOME);
    else if (user && !isLoading && !user.emailVerified) {
      router.replace(ROUTES.HOME);
      openAuthModal('verify');
    }
  }, [user, isLoading, router, openAuthModal]);

  const itemsByTab = useMemo(() => {
    const map: Record<ListStatus, typeof watchlist> = {
      watching: [],
      'on-hold': [],
      'plan-to-watch': [],
      dropped: [],
      completed: [],
    };
    LIST_TABS.forEach(({ key }) => {
      map[key] = getItemsByStatus(key);
    });
    return map;
  }, [watchlist]);

  const allItems = useMemo(() => [...watchlist], [watchlist]);

  const renderEmpty = (message: string, cta?: { label: string; href: string }) => (
    <div className="text-center py-16 text-gray-400">
      <p>{message}</p>
      {cta && (
        <Link href={cta.href} className="inline-block mt-4">
          <Button variant="primary" size="sm">
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  );

  const renderGrid = (items: { animeId: string; title: string; image: string; addedAt: Date; status?: ListStatus }[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-visible">
      {items.map((item) => (
        <WatchListCard
          key={item.animeId}
          item={item}
          onStatusChange={async (status) => {
            setListStatus(item.animeId, status);
            if (user?.uid) {
              try {
                await setListItemDb(user.uid, item.animeId, item.title, item.image, status);
              } catch (e) {
                console.error('Failed to update Firebase:', e);
              }
            }
          }}
          onRemove={async () => {
            removeFromList(item.animeId);
            if (user?.uid) {
              try {
                await removeFromWatchlistDb(user.uid, item.animeId);
              } catch (e) {
                console.error('Failed to remove from Firebase:', e);
              }
            }
          }}
        />
      ))}
    </div>
  );

  const continueWatching = useMemo(
    () => history.filter((item) => !item.completed && item.percentage < 90),
    [history]
  );

  const renderWatchingWithProgress = () => {
    if (continueWatching.length === 0) {
      return renderEmpty('You are not watching any shows right now.', {
        label: 'Find something to watch',
        href: ROUTES.HOME,
      });
    }

    const handleClearAll = async () => {
      if (!confirm('Clear all watch progress?')) return;
      clearHistory();
      if (user?.uid) {
        try {
          await clearWatchHistory(user.uid);
        } catch (e) {
          console.error('Failed to clear Firebase history:', e);
        }
      }
    };

    const handleRemove = async (animeId: string) => {
      removeFromHistory(animeId);
      if (user?.uid) {
        try {
          await removeFromWatchHistory(user.uid, animeId);
        } catch (e) {
          console.error('Failed to remove from Firebase:', e);
        }
      }
    };

    return (
      <>
        {user && continueWatching.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-400">{continueWatching.length} in progress</span>
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30">
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear All
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {continueWatching.map((item) => (
            <div
              key={item.animeId}
              className="group relative bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/50 hover:border-blue-500/50 transition-all"
            >
              <Link
                href={
                  ROUTES.WATCH(item.animeId, item.episodeId) +
                  (item.timestamp > 0 && item.percentage < 90 ? `?t=${Math.round(item.timestamp)}` : '')
                }
                className="flex gap-4 p-4"
              >
                <div className="relative w-20 h-28 sm:w-24 sm:h-32 shrink-0 rounded-lg overflow-hidden bg-gray-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.animeImage} alt={item.animeTitle} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                    <div
                      className="h-full bg-blue-500 rounded-r transition-all"
                      style={{ width: `${Math.min(item.percentage, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0 py-1 pr-10">
                  <h3 className="font-semibold text-sm text-white line-clamp-2 group-hover:text-blue-400 transition-colors break-words">
                    {item.animeTitle}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Episode {item.episodeNumber}
                    {item.episodeTitle && ` · ${item.episodeTitle}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.percentage}% watched</p>
                </div>
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleRemove(item.animeId); }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-900/80 hover:bg-red-500/80 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  aria-label="Remove from history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  const renderProfileSection = () => {
    if (!user) {
      return (
        <section className="text-center py-16">
          <p className="text-gray-400 mb-4">Sign in to edit your profile.</p>
          <Button variant="primary" onClick={() => openAuthModal()}>
            Sign In
          </Button>
        </section>
      );
    }

    const handleSave = async () => {
      if (!displayName.trim()) return;
      setSaveLoading(true);
      setSaveSuccess(false);
      try {
        await updateUserDisplayName(displayName.trim());
        useUserStore.getState().setUser({ ...user, displayName: displayName.trim() });
        setSaveSuccess(true);
      } catch (err) {
        console.error('Failed to update profile:', err);
      } finally {
        setSaveLoading(false);
      }
    };

    const handleResendVerification = async () => {
      setVerifyLoading(true);
      try {
        const res = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send');
        setSaveSuccess(true);
      } catch (err) {
        console.error('Failed to resend verification:', err);
      } finally {
        setVerifyLoading(false);
      }
    };

    const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !user) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.type)) {
        alert('Please use JPEG, PNG, or WebP.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File too large. Max 5MB.');
        return;
      }
      setPhotoLoading(true);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Not authenticated');
        const formData = new FormData();
        formData.append('photo', file);
        const res = await fetch('/api/profile/upload-photo', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        useUserStore.getState().setUser({ ...user, photoURL: data.url });
        setSaveSuccess(true);
      } catch (err) {
        console.error('Photo upload failed:', err);
        alert(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setPhotoLoading(false);
        e.target.value = '';
      }
    };

    const handleChangePassword = async () => {
      setPasswordLoading(true);
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send');
        setSaveSuccess(true);
      } catch (err) {
        console.error('Failed to send password reset:', err);
      } finally {
        setPasswordLoading(false);
      }
    };

    const joinedDate = user.createdAt instanceof Date
      ? user.createdAt.toISOString().slice(0, 10)
      : new Date(user.createdAt).toISOString().slice(0, 10);

    return (
      <section className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-6 order-2 lg:order-1">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-400" />
            Edit Profile
          </h2>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <Input value={user.email} disabled className="bg-gray-800" />
            {!user.emailVerified && (
              <div className="mt-3 p-4 rounded-lg bg-gray-800 border border-gray-700 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-400">Not Verified</p>
                  <p className="text-sm text-gray-300 mt-1">Your account has not been verified.</p>
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={verifyLoading}
                    className="text-sm text-blue-400 hover:text-blue-300 underline mt-1 disabled:opacity-50"
                  >
                    {verifyLoading ? 'Sending...' : 'Click here to resend verification email.'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              Joined
            </label>
            <div className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm">
              {joinedDate}
            </div>
          </div>

          <button
            type="button"
            onClick={handleChangePassword}
            disabled={passwordLoading}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {passwordLoading ? 'Sending...' : 'Change password'}
          </button>

          {saveSuccess && (
            <p className="text-sm text-blue-400">Changes saved. Check your email if you requested verification or password reset.</p>
          )}

          <div className="pt-6 mt-6 border-t border-gray-800">
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={saveLoading}
              className="w-full sm:w-auto min-w-[140px] px-10 py-3 text-base font-semibold bg-blue-600 hover:bg-blue-700"
            >
              Save
            </Button>
          </div>
        </div>

        <div className="lg:w-48 shrink-0 flex flex-col items-center order-first lg:order-none">
          <div className="relative">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleUploadPhoto}
            />
            <UserAvatar
              photoURL={user.photoURL}
              name={user.displayName || user.email}
              size="xl"
              className="w-32 h-32"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoLoading}
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-gray-300 hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Edit profile picture"
            >
              {photoLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </section>
    );
  };

  const displayItems =
    activeSubTab === 'all' ? allItems : itemsByTab[activeSubTab] ?? [];

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {(!user || !user.emailVerified) && !isLoading ? null : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
        {/* Greeting banner */}
        <div className="mb-6 rounded-xl overflow-hidden bg-gradient-to-r from-blue-600/20 via-blue-500/10 to-transparent border border-gray-800/50">
          <div className="px-6 py-5 sm:py-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Hi, {user?.displayName || user?.email?.split('@')[0] || 'Guest'}
            </h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              Manage your profile, continue watching, and your anime list
            </p>
          </div>
        </div>

        {/* Top-level tabs: Profile | Continue Watching | Watch List */}
        <div className="mb-6 bg-gray-800/50 rounded-lg p-0.5 sm:p-1">
          <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto">
            {TOP_TABS.map(({ key, label, icon: Icon }) => {
              const active = activeSection === key;
              return (
                <Link
                  key={key}
                  href={ROUTES.PROFILE_SECTION(key)}
                  onClick={(e) => {
                    e.preventDefault();
                    setSection(key);
                  }}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-4 sm:py-3 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-blue-400 bg-gray-800'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${active ? 'text-blue-400' : ''}`} />
                  {label}
                  {active && (
                    <span className="absolute left-2 right-2 bottom-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sub-tabs (when Watch List is active) */}
        {activeSection === 'watchlist' && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-gray-400" />
              Watch List
            </h2>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {SUB_TABS.map(({ key, label }) => {
                const count =
                  key === 'all' ? allItems.length : itemsByTab[key as ListStatus]?.length ?? 0;
                const active = activeSubTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSubTab(key)}
                    className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        {activeSection === 'profile' && (
          <section>{renderProfileSection()}</section>
        )}

        {activeSection === 'watching' && (
          <section>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              Continue Watching
            </h2>
            {renderWatchingWithProgress()}
          </section>
        )}

        {activeSection === 'watchlist' && (
          <section>
            {displayItems.length === 0
              ? renderEmpty(
                  activeSubTab === 'all'
                    ? 'Your list is empty. Add anime from any anime page.'
                    : `No anime in ${SUB_TABS.find((t) => t.key === activeSubTab)?.label ?? activeSubTab}.`,
                  { label: 'Browse anime', href: ROUTES.HOME }
                )
              : renderGrid(displayItems)}
          </section>
        )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}
