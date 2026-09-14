/**
 * Village Arena invite-only access (game demo / tester allowlist).
 */

import type { User } from '@/types';

/** True when the signed-in user was granted Game demo access in Admin. */
export function canAccessGameDemo(
  user: Pick<User, 'gameDemoAccess'> | null | undefined
): boolean {
  return user?.gameDemoAccess === true;
}
