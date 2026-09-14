/** Serialize Firestore timestamps / dates for admin JSON APIs */

import { Timestamp } from 'firebase-admin/firestore';

export function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: () => Date; _seconds?: number };
  if (typeof maybe.toDate === 'function') {
    try {
      return maybe.toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof maybe._seconds === 'number') {
    return new Date(maybe._seconds * 1000).toISOString();
  }
  return null;
}
