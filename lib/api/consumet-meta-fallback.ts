/**
 * Consumet self-hosted fallback (HiAnime/aniwatch scrapers break when target sites change).
 * Set CONSUMET_API_URL to a running consumet-api (see docker-compose.consumet.yaml).
 */

import { axiosInstance } from './axios';
import type { EpisodeListResponse } from '@/types';
import type { StreamSourcesResponse } from '@/types/stream';

const CMET = 'cmet:';

function consumetBase(): string | null {
  const u = process.env.CONSUMET_API_URL || process.env.NEXT_PUBLIC_CONSUMET_API_URL;
  if (!u?.trim()) return null;
  // Official public instance was shut down; self-host (Docker) or a private instance only
  if (u.replace(/\/$/, '').endsWith('api.consumet.org')) return null;
  return u.replace(/\/$/, '');
}

export function isConsumetBackendConfigured(): boolean {
  return Boolean(consumetBase());
}

export function isConsumetEpisodeId(id: string): boolean {
  return id.startsWith(CMET);
}

export function encodeConsumetEpisodeId(provider: string, consumetEpisodeId: string): string {
  return (
    CMET +
    Buffer.from(JSON.stringify({ p: provider, i: consumetEpisodeId }), 'utf-8').toString('base64url')
  );
}

export function decodeConsumetEpisodeId(
  id: string
): { provider: string; consumetEpisodeId: string } | null {
  if (!isConsumetEpisodeId(id)) return null;
  try {
    const o = JSON.parse(Buffer.from(id.slice(CMET.length), 'base64url').toString('utf-8')) as {
      p?: string;
      i?: string;
    };
    if (o?.p && o?.i) return { provider: o.p, consumetEpisodeId: o.i };
  } catch {
    // ignore
  }
  return null;
}

/**
 * AniList ID → Gogo (via Consumet) episode list. Returns null if API down or not configured.
 */
export async function fetchConsumetMetaEpisodes(
  anilistId: string,
  animeId: string,
  isDub: boolean
): Promise<EpisodeListResponse | null> {
  const base = consumetBase();
  if (!base) return null;
  try {
    const url = `${base}/meta/anilist/episodes/${anilistId}`;
    const { data } = await axiosInstance.get(url, {
      params: {
        provider: 'gogoanime',
        ...(isDub ? { dub: 'true' } : {}),
      },
      timeout: 28000,
    });
    const list = Array.isArray(data) ? data : [];
    if (list.length === 0) return null;
    return {
      animeId,
      totalEpisodes: list.length,
      episodes: list.map((ep: { id: string; number: number; title?: string }) => ({
        id: encodeConsumetEpisodeId('gogoanime', ep.id),
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
      })),
      _provider: 'consumet-gogo',
    };
  } catch (e) {
    console.warn('[Consumet fallback] episode list failed:', (e as Error).message);
    return null;
  }
}

/**
 * Stream sources for a Gogo episode id (via self-hosted consumet-api).
 */
export async function fetchConsumetStreamSources(
  provider: string,
  consumetEpisodeId: string
): Promise<StreamSourcesResponse> {
  const base = consumetBase();
  if (!base) throw new Error('CONSUMET_API_URL is not set');
  const url = `${base}/anime/${encodeURIComponent(provider)}/watch/${encodeURIComponent(consumetEpisodeId)}`;
  const { data } = await axiosInstance.get(url, {
    timeout: 25000,
    headers: { Accept: 'application/json' },
  });
  if (!data?.sources?.length) {
    throw new Error('No sources in Consumet response');
  }
  return {
    headers: data.headers || {
      Referer: 'https://gogoanime3.co',
      Origin: 'https://gogoanime3.co',
    },
    sources: data.sources.map((s: { url: string; quality?: string; isM3U8?: boolean }) => ({
      url: s.url,
      quality: s.quality || 'default',
      isM3U8: s.isM3U8 !== false,
    })),
    subtitles: (data.subtitles || []).map(
      (t: { url: string; lang?: string; label?: string }) => ({
        url: t.url,
        lang: (t.lang || 'en') as string,
        label: t.label || t.lang || 'Subtitles',
      })
    ),
    embedUrl: data.embedURL,
  };
}
