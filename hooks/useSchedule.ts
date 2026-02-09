/**
 * useSchedule Hook
 * Fetches airing schedule for the next 7 days
 */

import { useQuery } from '@tanstack/react-query';
import { CACHE_DURATIONS } from '@/constants/api';

export interface ScheduleItem {
  time: string;
  title: string;
  episode: number;
  animeId: string;
}

export interface ScheduleDay {
  date: string;
  label: string;
  shortLabel: string;
  items: ScheduleItem[];
}

export interface ScheduleResponse {
  days: ScheduleDay[];
}

export function useSchedule() {
  return useQuery<ScheduleResponse>({
    queryKey: ['schedule'],
    queryFn: async () => {
      const response = await fetch('/api/schedule');
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    },
    staleTime: CACHE_DURATIONS.ANIME_LIST * 1000,
  });
}
