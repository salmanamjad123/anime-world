const STORAGE_KEY = 'va-arena-bgm';
const PENTATONIC = [220, 246.94, 261.63, 293.66, 329.63, 392, 440];
const PHRASE = [0, 2, 4, 3, 5, 4, 2, 0, 3, 1, 4, 2];

type Listener = () => void;

let wantOn = false;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let pad: OscillatorNode[] = [];
let loopTimer = 0;
let phraseIndex = 0;
let retainCount = 0;
let releaseTimer = 0;
const listeners = new Set<Listener>();

function readWant(): boolean {
  if (typeof window === 'undefined') return false;
  // Opt-in: music starts off unless the player turns it on.
  return window.localStorage.getItem(STORAGE_KEY) === 'on';
}

function emit() {
  listeners.forEach((listener) => listener());
}

function tone(frequency: number, time: number, duration: number, gainValue: number, type: OscillatorType) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = frequency;
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function schedulePhrase() {
  if (!ctx || !master || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  for (let i = 0; i < 4; i += 1) {
    const freq = PENTATONIC[PHRASE[(phraseIndex + i) % PHRASE.length] % PENTATONIC.length] ?? 220;
    tone(freq, now + i * 1.15, 2.4, 0.02, 'sine');
    if (i % 2 === 0) tone(freq / 2, now + i * 1.15, 2.8, 0.01, 'triangle');
  }
  phraseIndex = (phraseIndex + 4) % PHRASE.length;
}

function startPad() {
  if (!ctx || !master) return;
  stopPad();
  const freqs = [110, 164.81];
  pad = freqs.map((freq, index) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = index === 0 ? -4 : 5;
    gain.gain.value = 0.012;
    osc.connect(gain);
    gain.connect(master!);
    osc.start();
    return osc;
  });
}

function stopPad() {
  pad.forEach((osc) => {
    try {
      osc.stop();
      osc.disconnect();
    } catch {
      /* already stopped */
    }
  });
  pad = [];
}

async function ensureContext() {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.06;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    master.connect(filter);
    filter.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') await ctx.resume();
}

async function startGraph() {
  if (!wantOn || retainCount <= 0) return;
  await ensureContext();
  if (!ctx || ctx.state !== 'running') return;
  startPad();
  window.clearInterval(loopTimer);
  schedulePhrase();
  loopTimer = window.setInterval(schedulePhrase, 4600);
  emit();
}

function stopGraph() {
  window.clearInterval(loopTimer);
  loopTimer = 0;
  stopPad();
  if (ctx && ctx.state === 'running') void ctx.suspend();
  emit();
}

export function isArenaBgmWanted(): boolean {
  return wantOn;
}

export function isArenaBgmPlaying(): boolean {
  return wantOn && ctx?.state === 'running';
}

export function subscribeArenaBgm(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function retainArenaBgm() {
  if (typeof window !== 'undefined') window.clearTimeout(releaseTimer);
  if (retainCount === 0) wantOn = readWant();
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
  }, 500);
}

export async function setArenaBgm(on: boolean) {
  wantOn = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  }
  if (on) await startGraph();
  else stopGraph();
}

export async function toggleArenaBgm() {
  await setArenaBgm(!wantOn);
}

export async function unlockArenaBgm() {
  if (wantOn) await startGraph();
}
