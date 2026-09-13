/**
 * Arena BGM — real anime theme options via dropdown + local MP3 upload / file drop.
 */

import {
  BGM_OPTIONS,
  findOption,
  resolvePlayUrl,
  type AudioOption,
} from '@/lib/game/audio-library';

const STORAGE = {
  on: 'va-arena-bgm',
  theme: 'va-arena-bgm-id',
  volume: 'va-arena-bgm-vol',
} as const;

type Listener = () => void;

let wantOn = false;
let themeId = BGM_OPTIONS[0]!.id;
let volume = 0.7;
let retainCount = 0;
let releaseTimer = 0;
let audio: HTMLAudioElement | null = null;
let lastError: string | null = null;
const listeners = new Set<Listener>();

function readOn() {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(STORAGE.on);
  // Default ON once we have a bundled arena track — user can still mute.
  if (raw === null) return true;
  return raw === 'on';
}

function readTheme() {
  if (typeof window === 'undefined') return BGM_OPTIONS[0]!.id;
  const raw = window.localStorage.getItem(STORAGE.theme);
  if (raw && BGM_OPTIONS.some((o) => o.id === raw)) return raw;
  return BGM_OPTIONS[0]!.id;
}

function readVolume() {
  if (typeof window === 'undefined') return 0.7;
  const raw = Number(window.localStorage.getItem(STORAGE.volume));
  return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.7;
}

function emit() {
  listeners.forEach((listener) => listener());
}

function stopAudio() {
  if (!audio) return;
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  } catch {
    /* ignore */
  }
  audio = null;
}

async function playTheme(id: string) {
  const option = findOption(id) ?? BGM_OPTIONS[0]!;
  let url = await resolvePlayUrl(option);
  // Always-available local file the user already added.
  if (!url) url = '/music/arena.mp3';
  stopAudio();
  lastError = null;
  const el = new Audio(encodeURI(url));
  el.loop = true;
  el.preload = 'auto';
  el.volume = volume;
  audio = el;

  await new Promise<void>((resolve) => {
    const fail = (message: string) => {
      lastError = message;
      emit();
      resolve();
    };
    el.addEventListener(
      'error',
      () => fail(`Could not load “${option.label}”. Upload an MP3 or use Arena Battle.`),
      { once: true }
    );
    el.addEventListener(
      'canplay',
      () => {
        void el.play().then(resolve).catch(() => fail('Click Music once — browser blocked autoplay.'));
      },
      { once: true }
    );
    el.load();
  });
}

async function startGraph() {
  if (!wantOn || retainCount <= 0) return;
  await playTheme(themeId);
  emit();
}

function stopGraph() {
  stopAudio();
  emit();
}

export function getBgmThemes(): AudioOption[] {
  return BGM_OPTIONS;
}

export function getArenaBgmTheme(): string {
  return themeId;
}

export function getArenaBgmVolume(): number {
  return volume;
}

export function getArenaBgmError(): string | null {
  return lastError;
}

export function isArenaBgmWanted(): boolean {
  return wantOn;
}

export function isArenaBgmPlaying(): boolean {
  return Boolean(wantOn && audio && !audio.paused);
}

export function subscribeArenaBgm(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function retainArenaBgm() {
  if (typeof window !== 'undefined') {
    window.clearTimeout(releaseTimer);
    wantOn = readOn();
    themeId = readTheme();
    volume = readVolume();
  }
  retainCount += 1;
  if (wantOn) void startGraph();
  emit();
}

export function releaseArenaBgm() {
  retainCount = Math.max(0, retainCount - 1);
  if (retainCount > 0) return;
  if (typeof window === 'undefined') {
    stopGraph();
    return;
  }
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    if (retainCount === 0) stopGraph();
  }, 400);
}

export async function setArenaBgm(on: boolean) {
  wantOn = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE.on, on ? 'on' : 'off');
  }
  if (on) await startGraph();
  else stopGraph();
}

export async function setArenaBgmTheme(id: string) {
  themeId = id;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE.theme, id);
  }
  if (wantOn) await startGraph();
  else emit();
}

export async function setArenaBgmVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE.volume, String(volume));
  }
  if (audio) audio.volume = volume;
  emit();
}

export async function toggleArenaBgm() {
  await setArenaBgm(!wantOn);
}

export async function unlockArenaBgm() {
  if (wantOn) await startGraph();
}

/** Call after uploading a track for the current theme. */
export async function reloadArenaBgm() {
  if (wantOn) await startGraph();
  else emit();
}

// Legacy aliases used by older call sites
export type BgmThemeId = string;
