'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SlidersHorizontal, X, Upload } from 'lucide-react';
import {
  forgetPlayUrl,
  listUploadedIds,
  saveTrack,
  type AudioKind,
  type AudioOption,
} from '@/lib/game/audio-library';
import {
  getArenaBgmError,
  getArenaBgmTheme,
  getArenaBgmVolume,
  getBgmThemes,
  isArenaBgmWanted,
  releaseArenaBgm,
  reloadArenaBgm,
  retainArenaBgm,
  setArenaBgm,
  setArenaBgmTheme,
  setArenaBgmVolume,
  subscribeArenaBgm,
  unlockArenaBgm,
} from '@/lib/game/music';
import {
  getAttackId,
  getAttackOptions,
  getDamageId,
  getDamageOptions,
  getSfxVolume,
  previewAttack,
  previewDamage,
  setAttackId,
  setDamageId,
  setSfxVolume,
  subscribeSfx,
} from '@/lib/game/sfx';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export function MusicToggle({ className }: Props) {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [bgmId, setBgmId] = useState(getBgmThemes()[0]?.id ?? '');
  const [attackId, setAttack] = useState(getAttackOptions()[0]?.id ?? '');
  const [damageId, setDamage] = useState(getDamageOptions()[0]?.id ?? '');
  const [bgmVol, setBgmVol] = useState(0.7);
  const [sfxVol, setSfxVol] = useState(0.85);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{ kind: AudioKind; id: string } | null>(null);

  const refreshUploaded = async () => {
    const ids = await listUploadedIds();
    setUploaded(new Set(ids));
  };

  useEffect(() => {
    retainArenaBgm();
    const sync = () => {
      setOn(isArenaBgmWanted());
      setBgmId(getArenaBgmTheme());
      setBgmVol(getArenaBgmVolume());
      setAttack(getAttackId());
      setDamage(getDamageId());
      setSfxVol(getSfxVolume());
      setError(getArenaBgmError());
    };
    sync();
    void refreshUploaded();
    const unsubBgm = subscribeArenaBgm(sync);
    const unsubSfx = subscribeSfx(sync);
    const unlock = () => {
      void unlockArenaBgm();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      unsubBgm();
      unsubSfx();
      releaseArenaBgm();
    };
  }, []);

  const startUpload = (kind: AudioKind, id: string) => {
    uploadTarget.current = { kind, id };
    fileRef.current?.click();
  };

  const onFile = async (file: File | null) => {
    const target = uploadTarget.current;
    if (!file || !target) return;
    setBusy(target.id);
    try {
      forgetPlayUrl(target.id);
      await saveTrack(target.id, file);
      await refreshUploaded();
      if (target.kind === 'bgm') {
        await setArenaBgmTheme(target.id);
        await setArenaBgm(true);
        await reloadArenaBgm();
      } else if (target.kind === 'attack') {
        await setAttackId(target.id);
      } else {
        await setDamageId(target.id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
      uploadTarget.current = null;
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const status = (id: string) => (uploaded.has(id) ? '● ready' : '○ need MP3');

  const Dropdown = ({
    label,
    kind,
    value,
    options,
    onChange,
    onPreview,
  }: {
    label: string;
    kind: AudioKind;
    value: string;
    options: AudioOption[];
    onChange: (id: string) => void;
    onPreview?: () => void;
  }) => (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">{label}</span>
        <div className="flex gap-1">
          {onPreview && (
            <button
              type="button"
              onClick={onPreview}
              className="rounded border border-amber-200/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-100/80 hover:bg-white/5"
            >
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={() => startUpload(kind, value)}
            disabled={busy === value}
            className="inline-flex items-center gap-1 rounded border border-orange-400/40 bg-orange-950/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-orange-100 hover:bg-orange-900/50 disabled:opacity-50"
          >
            <Upload className="h-3 w-3" />
            {busy === value ? '…' : 'Upload MP3'}
          </button>
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-orange-500/40 bg-black/50 px-2 py-2 text-xs text-amber-50 outline-none focus:ring-2 focus:ring-orange-500"
      >
        {options.map((item) => (
          <option key={item.id} value={item.id} className="bg-[#1c1008]">
            {item.anime} — {item.label} {uploaded.has(item.id) ? '●' : '○'}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[10px] text-amber-100/50">{status(value)}</p>
    </div>
  );

  return (
    <div className={cn('relative', className)}>
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/*"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => void setArenaBgm(!on)}
          aria-pressed={on}
          aria-label={on ? 'Pause background music' : 'Play background music'}
          className="inline-flex items-center gap-1 rounded-md border border-amber-200/30 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-100 hover:bg-black/70"
        >
          {on ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {on ? 'Music' : 'Muted'}
        </button>
        <button
          type="button"
          onClick={() => {
            void unlockArenaBgm();
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-label="Audio settings"
          className="inline-flex items-center gap-1 rounded-md border border-amber-200/30 bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-100 hover:bg-black/70"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Audio
        </button>
      </div>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] cursor-default bg-black/40"
            aria-label="Close audio settings backdrop"
            onClick={() => setOpen(false)}
          />
          <div className="fixed right-3 top-[calc(var(--site-header-height,4rem)+3.25rem)] z-[80] flex max-h-[calc(100vh-6.5rem)] w-[min(94vw,22rem)] flex-col overflow-hidden rounded-xl border border-orange-400/40 bg-[#1c1008] text-amber-50 shadow-2xl sm:right-5">
            <div className="flex shrink-0 items-center justify-between border-b border-amber-200/10 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-300">Anime audio</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close audio settings">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
              <p className="text-[11px] leading-snug text-amber-100/70">
                Choose a track, then <span className="font-semibold text-amber-50">Upload MP3</span> for it.
              </p>

              <Dropdown
                label="Background music"
                kind="bgm"
                value={bgmId}
                options={getBgmThemes()}
                onChange={(id) => {
                  void setArenaBgmTheme(id);
                  void setArenaBgm(true);
                }}
              />

              <label className="mt-2 block">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">BGM volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgmVol}
                  onChange={(e) => void setArenaBgmVolume(Number(e.target.value))}
                  className="mt-1 w-full accent-orange-500"
                />
              </label>

              <Dropdown
                label="Attack music / SFX"
                kind="attack"
                value={attackId}
                options={getAttackOptions()}
                onChange={(id) => void setAttackId(id)}
                onPreview={() => void previewAttack()}
              />

              <Dropdown
                label="Damage music / SFX"
                kind="damage"
                value={damageId}
                options={getDamageOptions()}
                onChange={(id) => void setDamageId(id)}
                onPreview={() => void previewDamage()}
              />

              <label className="mt-2 block pb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-200/70">Attack / damage volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={sfxVol}
                  onChange={(e) => void setSfxVolume(Number(e.target.value))}
                  className="mt-1 w-full accent-orange-500"
                />
              </label>

              {error && <p className="mb-1 rounded-md bg-red-950/70 px-2 py-1.5 text-[11px] text-orange-200">{error}</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
