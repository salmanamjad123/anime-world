/**
 * Firestore Spark/Blaze quota circuit-breaker.
 * Google returns code 8 RESOURCE_EXHAUSTED and often takes ~10s to fail.
 * After the first hit, skip Firestore for a few minutes so ads/admin/stream
 * don't stack 10s timeouts.
 */

const QUOTA_COOLDOWN_MS = 5 * 60 * 1000;
/** Don't let a hung Firestore get() eat the stream/ads request budget. */
const FIRESTORE_BUDGET_MS = 1200;

let blockedUntil = 0;

export const FIRESTORE_QUOTA_MESSAGE =
  'Firebase Firestore quota exceeded (project anime-world-f9723). Daily reads/writes are used up, so users, ads settings, and stream cache cannot load until the quota resets (midnight US Pacific) or you upgrade the plan. Open Firebase Console → Usage and billing.';

export function isFirestoreQuotaError(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string; details?: string };
  const blob = `${e?.code ?? ''} ${e?.message ?? ''} ${e?.details ?? ''}`;
  return (
    e?.code === 8 ||
    e?.code === '8' ||
    /RESOURCE_EXHAUSTED|Quota exceeded/i.test(blob)
  );
}

export function markFirestoreQuotaExhausted(): void {
  blockedUntil = Date.now() + QUOTA_COOLDOWN_MS;
}

export function isFirestoreQuotaBlocked(): boolean {
  return Date.now() < blockedUntil;
}

export function noteFirestoreError(err: unknown): boolean {
  if (!isFirestoreQuotaError(err)) return false;
  markFirestoreQuotaExhausted();
  return true;
}

/** Race a Firestore call against a short budget. Quota errors trip the circuit. */
export async function firestoreBudget<T>(
  work: Promise<T>,
  fallback: T
): Promise<T> {
  if (isFirestoreQuotaBlocked()) return fallback;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Firestore budget exceeded')),
          FIRESTORE_BUDGET_MS
        );
      }),
    ]);
  } catch (err) {
    noteFirestoreError(err);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
