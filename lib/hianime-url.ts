/**
 * Streaming catalog base URL (Railway / local streaming-api).
 * Import only from server code (API routes, RSC, server libs).
 * Never put the Railway hostname in NEXT_PUBLIC_* — it ships to every browser.
 */
export const HIANIME_API_URL =
  process.env.HIANIME_API_URL ||
  process.env.NEXT_PUBLIC_HIANIME_API_URL ||
  'http://localhost:4000';
