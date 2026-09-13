/**
 * Local anime audio library.
 * Catalog lists real theme / SFX names. Audio bytes come from user uploads
 * (IndexedDB) or optional files under /public/game/music/ — we do not ship
 * copyrighted anime OSTs in the repo.
 */

const DB_NAME = 'va-arena-audio';
const DB_VERSION = 1;
const STORE = 'tracks';

export type AudioKind = 'bgm' | 'attack' | 'damage';

export type AudioOption = {
  id: string;
  label: string;
  anime: string;
  kind: AudioKind;
  /** Optional bundled path if the user drops a file into public/. */
  fileHint?: string;
};

export const BGM_OPTIONS: AudioOption[] = [
  { id: 'bgm-naruto-main', label: 'Fourth Hokage Theme', anime: 'Naruto', kind: 'bgm', fileHint: '/game/music/bgm/naruto-main.mp3' },
  { id: 'bgm-arena', label: 'Arena Battle', anime: 'Naruto', kind: 'bgm', fileHint: '/music/arena.mp3' },
  { id: 'bgm-op-overtaken', label: 'Overtaken', anime: 'One Piece', kind: 'bgm', fileHint: '/game/music/bgm/op-overtaken.mp3' },
  { id: 'bgm-jjk-opening', label: 'Kaikai Kitan', anime: 'Jujutsu Kaisen', kind: 'bgm', fileHint: '/game/music/bgm/jjk-opening.mp3' },
];

export const ATTACK_OPTIONS: AudioOption[] = [
  { id: 'atk-rasengan', label: 'Rasengan', anime: 'Naruto', kind: 'attack', fileHint: '/game/music/attack/rasengan.mp3' },
  { id: 'atk-gomu-pistol', label: 'Gomu Gomu no Pistol', anime: 'One Piece', kind: 'attack', fileHint: '/game/music/attack/gomu-pistol.mp3' },
  { id: 'atk-kamehameha', label: 'Kamehameha', anime: 'Dragon Ball', kind: 'attack', fileHint: '/game/music/attack/kamehameha.mp3' },
  { id: 'atk-getsuga', label: 'Getsuga Tensho', anime: 'Bleach', kind: 'attack', fileHint: '/game/music/attack/getsuga.mp3' },
];

export const DAMAGE_OPTIONS: AudioOption[] = [
  { id: 'dmg-heavy-hit', label: 'Heavy Hit', anime: 'General', kind: 'damage', fileHint: '/game/music/damage/heavy-hit.mp3' },
  { id: 'dmg-slash', label: 'Critical Slash', anime: 'General', kind: 'damage', fileHint: '/game/music/damage/slash.mp3' },
  { id: 'dmg-explosion', label: 'Explosion', anime: 'General', kind: 'damage', fileHint: '/game/music/damage/explosion.mp3' },
  { id: 'dmg-energy', label: 'Energy Hit', anime: 'General', kind: 'damage', fileHint: '/game/music/damage/energy.mp3' },
];

export function optionsFor(kind: AudioKind): AudioOption[] {
  if (kind === 'bgm') return BGM_OPTIONS;
  if (kind === 'attack') return ATTACK_OPTIONS;
  return DAMAGE_OPTIONS;
}

export function findOption(id: string): AudioOption | undefined {
  return [...BGM_OPTIONS, ...ATTACK_OPTIONS, ...DAMAGE_OPTIONS].find((item) => item.id === id);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

export type StoredTrack = {
  id: string;
  mime: string;
  buffer: ArrayBuffer;
  name: string;
  updatedAt: number;
};

export async function saveTrack(id: string, file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id,
      mime: file.type || 'audio/mpeg',
      buffer,
      name: file.name,
      updatedAt: Date.now(),
    } satisfies StoredTrack);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Save failed'));
  });
  db.close();
}

export async function deleteTrack(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Delete failed'));
  });
  db.close();
}

export async function loadTrack(id: string): Promise<StoredTrack | null> {
  try {
    const db = await openDb();
    const track = await new Promise<StoredTrack | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as StoredTrack | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Load failed'));
    });
    db.close();
    return track;
  } catch {
    return null;
  }
}

export async function listUploadedIds(): Promise<string[]> {
  try {
    const db = await openDb();
    const ids = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
      req.onerror = () => reject(req.error ?? new Error('List failed'));
    });
    db.close();
    return ids;
  } catch {
    return [];
  }
}

const urlCache = new Map<string, string>();

export async function resolvePlayUrl(option: AudioOption): Promise<string | null> {
  const cached = urlCache.get(option.id);
  if (cached) return cached;

  const uploaded = await loadTrack(option.id);
  if (uploaded) {
    const blob = new Blob([uploaded.buffer], { type: uploaded.mime || 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    urlCache.set(option.id, url);
    return url;
  }

  if (option.fileHint) {
    // Bundled/local paths — try play; missing files fail at Audio.play with a clear error.
    urlCache.set(option.id, option.fileHint);
    return option.fileHint;
  }
  return null;
}

export function forgetPlayUrl(id: string) {
  const url = urlCache.get(id);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  urlCache.delete(id);
}
