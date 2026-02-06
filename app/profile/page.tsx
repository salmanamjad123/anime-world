/**
 * Profile Page
 * Per-user library: Watching, On-Hold, Plan to watch, Dropped, Completed
 */

'use client';

import { Header } from '@/components/layout/Header';
import { useUserStore } from '@/store/useUserStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import { Button } from '@/components/ui/Button';
import type { ListStatus } from '@/types';

const TAB_KEYS: ListStatus[] = ['watching', 'on-hold', 'plan-to-watch', 'dropped', 'completed'];

const LIST_TABS: { key: ListStatus; label: string }[] = [
  { key: 'watching', label: 'Watching' },
  { key: 'on-hold', label: 'On-Hold' },
  { key: 'plan-to-watch', label: 'Plan to watch' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'completed', label: 'Completed' },
];

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: ListStatus = TAB_KEYS.includes(tabParam as ListStatus) ? (tabParam as ListStatus) : 'watching';
  const setActiveTab = (key: ListStatus) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', key);
    router.replace(`${ROUTES.PROFILE}?${params.toString()}`, { scroll: false });
  };

  const { user } = useUserStore();
  const { watchlist, getItemsByStatus } = useWatchlistStore();
  const { history } = useHistoryStore();

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

  const renderGrid = (items: { animeId: string; title: string; image: string; addedAt: Date }[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <Link
          key={item.animeId}
          href={ROUTES.ANIME_DETAIL(item.animeId)}
          className="block bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
        >
          <div className="relative aspect-[2/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-sm text-white line-clamp-2">
              {item.title}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Added {item.addedAt.toLocaleDateString()}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );

  const renderWatchingWithProgress = () => {
    const items = getItemsByStatus('watching');
    const withProgress = items.map((item) => {
      const progress = history.find((h) => h.animeId === item.animeId && !h.completed);
      return { ...item, progress };
    });

    if (withProgress.length === 0) {
      return renderEmpty('You are not watching any shows right now.', {
        label: 'Find something to watch',
        href: ROUTES.HOME,
      });
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {withProgress.map((item) => (
          <Link
            key={item.animeId}
            href={
              item.progress
                ? ROUTES.WATCH(item.animeId, item.progress.episodeId)
                : ROUTES.ANIME_DETAIL(item.animeId)
            }
            className="flex gap-3 bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
          >
            <div className="relative w-24 sm:w-28 md:w-32 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 p-3 min-w-0">
              <h3 className="text-sm font-semibold text-white truncate">
                {item.title}
              </h3>
              {item.progress && (
                <>
                  <p className="text-xs text-gray-500 mt-1">
                    Episode {item.progress.episodeNumber} · {item.progress.percentage}% watched
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(item.progress.percentage, 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Profile header */}
        <section className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-semibold text-white">
              {(user?.displayName || user?.email || 'Guest').charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                {user?.displayName || user?.email || 'Guest profile'}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                {user
                  ? 'Your library is synced to your account.'
                  : 'Not logged in – your list is saved on this device only.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 sm:gap-6 text-sm text-gray-300">
            {LIST_TABS.map(({ key, label }) => (
              <div key={key}>
                <p className="font-semibold text-white">{itemsByTab[key]?.length ?? 0}</p>
                <p className="text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-800">
          <nav className="flex flex-wrap gap-2 text-sm">
            {LIST_TABS.map(({ key, label }) => {
              const count = itemsByTab[key]?.length ?? 0;
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative px-3 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${
                    active ? 'text-blue-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  {label}
                  <span className="ml-1 text-xs text-gray-500">({count})</span>
                  {active && (
                    <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'watching' && (
          <section>{renderWatchingWithProgress()}</section>
        )}

        {activeTab !== 'watching' && (
          <section>
            {(itemsByTab[activeTab]?.length ?? 0) === 0
              ? renderEmpty(`No anime in ${LIST_TABS.find((t) => t.key === activeTab)?.label ?? activeTab}.`, {
                  label: 'Browse anime',
                  href: ROUTES.HOME,
                })
              : renderGrid(itemsByTab[activeTab] ?? [])}
          </section>
        )}
      </main>
    </div>
  );
}
