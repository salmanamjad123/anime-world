'use client';

/**
 * Attack + damage SFX — separate dropdown selections, real clips via upload / file drop.
 */

import type { CombatEvent, SideId } from '@/lib/game/engine';
import {
  ATTACK_OPTIONS,
  DAMAGE_OPTIONS,
  findOption,
  resolvePlayUrl,
  type AudioOption,
} from '@/lib/game/audio-library';

const STORAGE = {
  attack: 'va-arena-atk-id',
  damage: 'va-arena-dmg-id',
  volume: 'va-arena-sfx-vol',
  on: 'va-arena-sfx-on',
} as const;

type Listener = () => void;

let attackId = ATTACK_OPTIONS[0]!.id;
let damageId = DAMAGE_OPTIONS[0]!.id;
let volume = 0.85;
let sfxOn = true;
const listeners = new Set<Listener>();
const players = new Map<string, HTMLAudioElement>();

function read(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function readVolume() {
  if (typeof window === 'undefined') return 0.85;
  const raw = Number(window.localStorage.getItem(STORAGE.volume));
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.85;
}

function readOn() {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STORAGE.on);
  return raw !== 'off' && raw !== '0' && raw !== 'false';
}

function hydrate() {
  const atk = read(STORAGE.attack, ATTACK_OPTIONS[0]!.id);
  const dmg = read(STORAGE.damage, DAMAGE_OPTIONS[0]!.id);
  attackId = ATTACK_OPTIONS.some((o) => o.id === atk) ? atk : ATTACK_OPTIONS[0]!.id;
  damageId = DAMAGE_OPTIONS.some((o) => o.id === dmg) ? dmg : DAMAGE_OPTIONS[0]!.id;
  volume = readVolume();
  sfxOn = readOn();
}

function emit() {
  listeners.forEach((listener) => listener());
}

async function playOption(id: string) {
  if (!sfxOn || typeof window === 'undefined') return;
  const option = findOption(id);
  if (!option) return;
  const url = await resolvePlayUrl(option);
  if (!url) return;

  let el = players.get(id);
  if (!el) {
    el = new Audio();
    players.set(id, el);
  }
  try {
    if (el.src !== url && !el.src.endsWith(url)) {
      el.src = url;
    }
    el.volume = volume;
    el.currentTime = 0;
    await el.play();
  } catch {
    /* autoplay / missing */
  }
}

export async function playUiClick() {
  /* keep quiet for UI */
}

export async function playLockReady() {}

export async function playVictory() {
  hydrate();
  await playOption(attackId);
}

export async function playDefeat() {
  hydrate();
  await playOption(damageId);
}

export async function playCombatFromPerspective(events: CombatEvent[], _mySide: SideId) {
  hydrate();
  if (!events?.length || !sfxOn) return;
  let delay = 0;
  for (const event of events.slice(0, 10)) {
    const id = event.kind === 'attack' || event.kind === 'stun' || event.kind === 'drain'
      ? attackId
      : event.kind === 'hit' || event.kind === 'seal' || event.kind === 'block'
        ? damageId
        : null;
    if (!id) continue;
    window.setTimeout(() => {
      void playOption(id);
    }, delay);
    delay += 80;
  }
}

export function getAttackOptions(): AudioOption[] {
  return ATTACK_OPTIONS;
}

export function getDamageOptions(): AudioOption[] {
  return DAMAGE_OPTIONS;
}

export function getAttackId(): string {
  hydrate();
  return attackId;
}

export function getDamageId(): string {
  hydrate();
  return damageId;
}

export function getSfxVolume(): number {
  hydrate();
  return volume;
}

export function isSfxOn(): boolean {
  hydrate();
  return sfxOn;
}

export function subscribeSfx(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function setAttackId(id: string) {
  attackId = id;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE.attack, id);
  await playOption(id);
  emit();
}

export async function setDamageId(id: string) {
  damageId = id;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE.damage, id);
  await playOption(id);
  emit();
}

export async function setSfxVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE.volume, String(volume));
  emit();
}

export async function setSfxOn(on: boolean) {
  sfxOn = on;
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE.on, on ? 'on' : 'off');
  emit();
}

export async function previewAttack() {
  hydrate();
  await playOption(attackId);
}

export async function previewDamage() {
  hydrate();
  await playOption(damageId);
}

// Back-compat shims so old imports don't explode during HMR
export type SfxPackId = string;
export function getSfxPack() {
  return getAttackId();
}
export function getSfxPacks() {
  return getAttackOptions();
}
export async function setSfxPack(id: string) {
  await setAttackId(id);
}
