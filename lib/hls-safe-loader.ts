/**
 * HLS loader that filters browser-forbidden headers (Referer, Origin).
 * Prevents "Refused to set unsafe header" console warnings when the manifest
 * or fragment context includes these headers - the proxy adds them server-side.
 */

import Hls, { XhrLoader } from 'hls.js';
import type { Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext, LoaderStats } from 'hls.js';
import type { HlsConfig } from 'hls.js';

const FORBIDDEN_HEADERS = ['referer', 'origin'];

function filterHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') return headers;
  const filtered: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    if (!FORBIDDEN_HEADERS.includes(key.toLowerCase())) {
      filtered[key] = headers[key];
    }
  }
  return Object.keys(filtered).length ? filtered : undefined;
}

/**
 * Wraps the default XhrLoader and filters Referer/Origin from context.headers
 * before passing to the actual loader.
 */
export class HlsSafeLoader implements Loader<LoaderContext> {
  private loader: Loader<LoaderContext>;
  public context: LoaderContext | null = null;
  public stats: LoaderStats;

  constructor(config: HlsConfig) {
    this.loader = new XhrLoader(config);
    this.stats = this.loader.stats;
  }

  load(
    context: LoaderContext,
    config: LoaderConfiguration,
    callbacks: LoaderCallbacks<LoaderContext>,
  ): void {
    const safeContext = { ...context, headers: filterHeaders(context.headers) };
    this.context = safeContext;
    this.loader.load(safeContext, config, callbacks);
  }

  abort(): void {
    this.loader.abort();
  }

  destroy(): void {
    this.loader.destroy();
    this.loader = null!;
    this.context = null;
  }

  getCacheAge(): number | null {
    return this.loader.getCacheAge?.() ?? null;
  }

  getResponseHeader(name: string): string | null {
    return this.loader.getResponseHeader?.(name) ?? null;
  }
}
