'use client';

import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

export function AnimeDetailSkeleton({
  slowLoad,
  onRetry,
}: {
  slowLoad?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <div className="relative min-h-[380px] md:h-[500px] w-full">
        <div className="absolute inset-0 bg-gray-800/60" />
        <div className="relative container mx-auto px-4 h-full flex flex-col items-center md:items-start pt-4 pb-5 md:pt-0 md:pb-12 md:justify-end">
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full max-w-6xl">
            <div className="shrink-0 w-40 mx-auto md:mx-0 md:w-48 md:-mb-24">
              <div className="aspect-[2/3] rounded-lg bg-gray-700 animate-pulse" />
            </div>
            <div className="flex-1 md:pb-8 space-y-3 text-center md:text-left">
              <div className="h-8 md:h-10 w-2/3 mx-auto md:mx-0 rounded bg-gray-700 animate-pulse" />
              <div className="h-4 w-1/3 mx-auto md:mx-0 rounded bg-gray-800 animate-pulse" />
              <div className="h-4 w-1/2 mx-auto md:mx-0 rounded bg-gray-800 animate-pulse" />
              <p className="text-gray-400 text-sm pt-2">Loading anime details…</p>
              {slowLoad && (
                <div className="flex flex-col items-center md:items-start gap-3 pt-2">
                  <p className="text-gray-500 text-xs max-w-sm">
                    This is taking longer than usual. The catalog may be slow.
                  </p>
                  {onRetry && (
                    <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 pb-12 mt-6">
        <div className="h-40 rounded-lg bg-gray-800/50 animate-pulse" />
      </div>
    </div>
  );
}
