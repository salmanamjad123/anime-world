/**
 * AniList API Rate Throttle
 * Limits outbound requests to stay under AniList's 90/min limit.
 * Prevents 429 when many users open different anime simultaneously.
 */

import { RATE_LIMITS } from '@/constants/api';

const MAX_PER_MINUTE = Math.floor(RATE_LIMITS.ANILIST * 0.85); // 76 - stay under 90
const WINDOW_MS = 60_000;

let count = 0;
let windowStart = 0;

/**
 * Call before each AniList request. Waits if we're at the limit.
 */
export async function acquireAnilistSlot(): Promise<void> {
  const now = Date.now();

  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    count = 0;
  }

  if (count < MAX_PER_MINUTE) {
    count++;
    return;
  }

  const waitMs = WINDOW_MS - (now - windowStart);
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 5000)));
  }
  return acquireAnilistSlot();
}
