/**
 * Technique-specific skill tile art (Naruto Arena–style).
 * Prefers /public/game/skills/{fighterId}/{artId}.png when present;
 * otherwise renders a named technique emblem (not a recycled fighter portrait).
 */

import type { Art } from '@/types/game';
import { skillArtPath } from '@/lib/game/roster';

export type SkillFamily = 'damage' | 'heal' | 'shield' | 'stun' | 'status' | 'drain' | 'defend' | 'dodge';

export function skillFamily(art: Art): SkillFamily {
  if (art.id === 'aegis-veil' || art.universal) return 'defend';
  if (art.effects.some((e) => e.type === 'APPLY_STATUS' && e.status === 'dodge')) return 'dodge';
  const types = new Set(art.effects.map((e) => e.type));
  if (types.has('DAMAGE')) return 'damage';
  if (types.has('HEAL')) return 'heal';
  if (types.has('SHIELD')) return 'shield';
  if (types.has('STUN')) return 'stun';
  if (types.has('DRAIN_WEAVE') || types.has('STEAL_WEAVE')) return 'drain';
  if (types.has('APPLY_STATUS')) {
    if (art.effects.some((e) => e.type === 'APPLY_STATUS' && (e.status === 'veil' || e.status === 'dr'))) {
      return 'defend';
    }
    return 'status';
  }
  return 'damage';
}

export function resolvedSkillArtSrc(fighterId: string, art: Art): string {
  if (art.icon) return art.icon;
  return skillArtPath(fighterId, art.id);
}

export type TechniqueTheme = {
  family: SkillFamily;
  mark: string;
  gradient: [string, string];
  accent: string;
};

const NAME_THEMES: Array<{ test: RegExp; mark: string; gradient: [string, string]; accent: string }> = [
  { test: /rasengan|rasenshuriken|spiral/i, mark: '螺旋', gradient: ['#0ea5e9', '#f97316'], accent: '#fff7ed' },
  { test: /chidori|lightning|raigeki|kirin/i, mark: '雷', gradient: ['#1e3a8a', '#e0f2fe'], accent: '#e0f2fe' },
  { test: /katon|fire|goukakyuu|amaterasu|flame|hinokami/i, mark: '炎', gradient: ['#7f1d1d', '#fbbf24'], accent: '#fef3c7' },
  { test: /shadow|shikamaru|bind|neck/i, mark: '影', gradient: ['#111827', '#4b5563'], accent: '#e5e7eb' },
  { test: /heal|palm|mystical|katsuyu|medical/i, mark: '癒', gradient: ['#14532d', '#86efac'], accent: '#ecfdf5' },
  { test: /clone|feint|dodge|substitution/i, mark: '遁', gradient: ['#164e63', '#67e8f9'], accent: '#cffafe' },
  { test: /kamehameha|ki blast|spirit bomb|galick/i, mark: '気', gradient: ['#1d4ed8', '#93c5fd'], accent: '#dbeafe' },
  { test: /getsuga|bankai|zanpakuto/i, mark: '月', gradient: ['#0f172a', '#38bdf8'], accent: '#e0f2fe' },
  { test: /domain|hollow|cursed|black flash/i, mark: '呪', gradient: ['#2e1065', '#c084fc'], accent: '#f3e8ff' },
  { test: /breath|water|sun|thunderclap/i, mark: '呼', gradient: ['#881337', '#fda4af'], accent: '#fff1f2' },
  { test: /stun|genjutsu|tsukuyomi|sharingan/i, mark: '幻', gradient: ['#4c1d95', '#f472b6'], accent: '#fce7f3' },
  { test: /shield|guard|veil|barrier|aegis/i, mark: '防', gradient: ['#1e293b', '#94a3b8'], accent: '#f1f5f9' },
  { test: /drain|absorb|vamp|steal/i, mark: '吸', gradient: ['#4a044e', '#f472b6'], accent: '#fce7f3' },
];

const FAMILY_FALLBACK: Record<SkillFamily, Omit<TechniqueTheme, 'family'>> = {
  damage: { mark: '攻', gradient: ['#7f1d1d', '#ea580c'], accent: '#ffedd5' },
  heal: { mark: '癒', gradient: ['#14532d', '#4ade80'], accent: '#dcfce7' },
  shield: { mark: '盾', gradient: ['#0c4a6e', '#38bdf8'], accent: '#e0f2fe' },
  stun: { mark: '止', gradient: ['#4c1d95', '#e879f9'], accent: '#fae8ff' },
  status: { mark: '術', gradient: ['#78350f', '#fbbf24'], accent: '#fef3c7' },
  drain: { mark: '吸', gradient: ['#831843', '#fb7185'], accent: '#ffe4e6' },
  defend: { mark: '防', gradient: ['#334155', '#94a3b8'], accent: '#f1f5f9' },
  dodge: { mark: '避', gradient: ['#115e59', '#2dd4bf'], accent: '#ccfbf1' },
};

export function techniqueTheme(art: Art): TechniqueTheme {
  const family = skillFamily(art);
  for (const row of NAME_THEMES) {
    if (row.test.test(art.name) || row.test.test(art.id)) {
      return { family, mark: row.mark, gradient: row.gradient, accent: row.accent };
    }
  }
  return { family, ...FAMILY_FALLBACK[family] };
}

export function skillTileLabel(art: Art): string {
  const name = art.name.trim();
  if (name.length <= 14) return name;
  const afterColon = name.split(':').pop()?.trim();
  if (afterColon && afterColon.length <= 14) return afterColon;
  return `${name.slice(0, 12)}…`;
}

export function artClasses(art: Art): string[] {
  const family = skillFamily(art);
  const tags: string[] = [];
  if (family === 'damage') tags.push('Melee', 'Physical');
  if (family === 'heal') tags.push('Heal', 'Medical');
  if (family === 'shield' || family === 'defend') tags.push('Guard');
  if (family === 'dodge') tags.push('Evasion');
  if (family === 'stun') tags.push('Control', 'Stun');
  if (family === 'drain') tags.push('Drain');
  if (family === 'status') tags.push('Status');
  if (art.target === 'all-enemies' || art.target === 'all-allies') tags.push('AoE');
  if (art.effects.some((e) => e.type === 'DAMAGE' && e.kind === 'pierce')) tags.push('Pierce');
  if (art.effects.some((e) => e.type === 'DAMAGE' && e.kind === 'affliction')) tags.push('Affliction');
  if (art.persistence === 'action') tags.push('Action');
  if (art.persistence === 'control') tags.push('Control');
  if ((art.cooldown ?? 0) === 0) tags.push('Static');
  return tags.length > 0 ? tags : ['Jutsu'];
}
