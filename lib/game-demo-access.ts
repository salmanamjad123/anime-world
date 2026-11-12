/**
 * Village Arena access.
 * Full Anime Village: invite-only (`gameDemoAccess`).
 * Game-arena branch: any signed-in user (product is the game).
 */

import type { User } from '@/types';
import { IS_GAME_ARENA_ONLY } from '@/constants/site-mode';

/** True when the user may enter Village Arena. */
export function canAccessGameDemo(
  user: Pick<User, 'gameDemoAccess'> | null | undefined
): boolean {
  if (IS_GAME_ARENA_ONLY) return Boolean(user);
  return user?.gameDemoAccess === true;
}
