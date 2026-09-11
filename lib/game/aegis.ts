import type { Art } from '@/types/game';

/** Universal defend art — every fighter has this as skill 4. */
export const AEGIS_VEIL: Art = {
  id: 'aegis-veil',
  name: 'Aegis Veil',
  description: 'Become untouchable until the next Echo. 4 Echo cooldown.',
  cooldown: 4,
  energy: { any: 1 },
  target: 'self',
  effects: [{ type: 'APPLY_STATUS', status: 'veil', echoes: 1, target: 'self' }],
  universal: true,
};
