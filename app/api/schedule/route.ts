/**
 * Schedule API
 * Returns airing schedule from AniList for the next 7 days
 */

import { NextResponse } from 'next/server';
import { axiosInstance } from '@/lib/api/axios';
import { ANILIST_API_URL } from '@/constants/api';
import { getPreferredTitle } from '@/lib/utils';

const AIRING_SCHEDULE_QUERY = `
  query ($airingAtGreater: Int, $airingAtLesser: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        hasNextPage
      }
      airingSchedules(
        airingAt_greater: $airingAtGreater
        airingAt_lesser: $airingAtLesser
        sort: [TIME]
      ) {
        id
        airingAt
        episode
        mediaId
        media {
          id
          title {
            romaji
            english
            native
          }
        }
      }
    }
  }
`;

function getStartOfDayUTC(date: Date): number {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}


export async function GET() {
  try {
    const now = new Date();
    const todayStart = getStartOfDayUTC(now);
    const endTimestamp = todayStart + 7 * 24 * 3600;

    const dayMap = new Map<string, Array<{ time: string; title: string; episode: number; animeId: string }>>();
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await axiosInstance.post<{
        data: {
          Page: {
            pageInfo: { hasNextPage: boolean };
            airingSchedules: Array<{
              id: number;
              airingAt: number;
              episode: number;
              mediaId: number;
              media: {
                id: number;
                title: { romaji: string; english?: string; native?: string };
              };
            }>;
          };
        };
      }>(ANILIST_API_URL, {
        query: AIRING_SCHEDULE_QUERY,
        variables: {
          airingAtGreater: todayStart,
          airingAtLesser: endTimestamp,
          page,
        },
      });

      const pageData = response.data?.data?.Page;
      const schedules = pageData?.airingSchedules ?? [];
      hasNextPage = pageData?.pageInfo?.hasNextPage ?? false;

      for (const item of schedules) {
        const date = new Date(item.airingAt * 1000);
        const dayKey = date.toISOString().slice(0, 10);
        const timeStr = date.toTimeString().slice(0, 5);

        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, []);
        }

        const title = getPreferredTitle(item.media.title);
        dayMap.get(dayKey)!.push({
          time: timeStr,
          title,
          episode: item.episode,
          animeId: String(item.mediaId),
        });
      }

      page++;
      if (schedules.length < 50) hasNextPage = false;
    }

    const days: Array<{ date: string; label: string; shortLabel: string; items: Array<{ time: string; title: string; episode: number; animeId: string }> }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date((todayStart + i * 86400) * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      days.push({
        date: dateStr,
        label: `${dayName} ${monthDay}`,
        shortLabel: dayName,
        items: dayMap.get(dateStr) ?? [],
      });
    }

    return NextResponse.json({ days });
  } catch (error) {
    console.error('[Schedule API]', error);
    return NextResponse.json({ error: 'Failed to fetch schedule', days: [] }, { status: 500 });
  }
}
