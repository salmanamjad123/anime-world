'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Art } from '@/types/game';
import { fighterPortrait } from '@/lib/game/roster';
import { cn } from '@/lib/utils';
import {
  resolvedSkillArtSrc,
  skillFamily,
  skillTileLabel,
  techniqueTheme,
} from '@/lib/game/skill-art';

/** Cache skill PNG existence so dropped files light up without roster edits. */
const skillArtExists = new Map<string, boolean>();

function probeSkillArt(src: string): Promise<boolean> {
  if (skillArtExists.has(src)) return Promise.resolve(skillArtExists.get(src)!);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      skillArtExists.set(src, true);
      resolve(true);
    };
    img.onerror = () => {
      skillArtExists.set(src, false);
      resolve(false);
    };
    img.src = src;
  });
}

type Props = {
  art: Art;
  fighterId: string;
  size?: number;
  active?: boolean;
  dim?: boolean;
  cooldown?: number;
  showName?: boolean;
  className?: string;
};

/**
 * NA-style jutsu tile under each fighter:
 * - Dedicated PNG at /game/skills/{id}/{artId}.png (or art.icon) when available
 * - Else character portrait + technique wash + glyph (attack-specific)
 * - Attack name labeled under the tile
 */
export function SkillTile({
  art,
  fighterId,
  size = 52,
  active,
  dim,
  cooldown = 0,
  showName = true,
  className,
}: Props) {
  const theme = techniqueTheme(art);
  const family = skillFamily(art);
  const label = skillTileLabel(art);
  const fileSrc = resolvedSkillArtSrc(fighterId, art);
  const [useFile, setUseFile] = useState(
    () => Boolean(art.icon) || skillArtExists.get(fileSrc) === true
  );
  const [portraitOk, setPortraitOk] = useState(true);

  useEffect(() => {
    if (art.icon) {
      setUseFile(true);
      return;
    }
    let cancelled = false;
    void probeSkillArt(fileSrc).then((ok) => {
      if (!cancelled) setUseFile(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [art.icon, fileSrc]);

  return (
    <span className={cn('inline-flex flex-col items-center gap-0.5', className)}>
      <span
        className={cn(
          'relative block shrink-0 overflow-hidden rounded-sm shadow-md ring-1 ring-[#c4a574]/50',
          active && 'ring-2 ring-amber-200',
          dim && 'opacity-40 grayscale'
        )}
        style={{ width: size, height: size }}
        title={art.name}
      >
        {useFile ? (
          <Image
            src={fileSrc}
            alt={art.name}
            fill
            sizes={`${size}px`}
            className="object-cover object-center"
            onError={() => {
              skillArtExists.set(fileSrc, false);
              setUseFile(false);
            }}
          />
        ) : (
          <>
            {portraitOk ? (
              <Image
                src={fighterPortrait(fighterId)}
                alt=""
                fill
                sizes={`${size}px`}
                className="object-cover object-top"
                onError={() => setPortraitOk(false)}
              />
            ) : (
              <span className="absolute inset-0" style={{ background: theme.gradient[0] }} />
            )}
            <span
              className="absolute inset-0"
              style={{
                background: `linear-gradient(145deg, ${theme.gradient[0]}cc 0%, transparent 45%, ${theme.gradient[1]}99 100%)`,
              }}
            />
            <TechniqueGlyph art={art} accent={theme.accent} mark={theme.mark} />
          </>
        )}

        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-0.5 pb-0.5 pt-4 text-center text-[7px] font-black uppercase leading-none tracking-wide text-amber-50">
          {family === 'damage' ? 'ATK' : family.slice(0, 4).toUpperCase()}
        </span>

        {cooldown > 0 && (
          <span className="absolute inset-0 z-[1] flex items-center justify-center bg-black/70 text-base font-black text-amber-100">
            {cooldown}
          </span>
        )}
      </span>

      {showName && (
        <span
          className="w-full truncate text-center text-[9px] font-bold leading-tight text-amber-50/95"
          title={art.name}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function TechniqueGlyph({
  art,
  accent,
  mark,
}: {
  art: Art;
  accent: string;
  mark: string;
}) {
  const n = `${art.name} ${art.id}`.toLowerCase();
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden>
      {/rasengan|spiral|rasenshuriken/.test(n) && (
        <g fill="none" stroke={accent} strokeWidth="2.2" opacity="0.85">
          <circle cx="32" cy="28" r="14" />
          <circle cx="32" cy="28" r="7" />
        </g>
      )}
      {/chidori|lightning|kirin|thunder/.test(n) && (
        <path d="M28 10 L38 26 H30 L40 50 L24 32 H34 Z" fill={accent} opacity="0.75" />
      )}
      {/katon|fire|flame|amaterasu|hinokami|goukakyuu/.test(n) && (
        <path
          d="M32 8 C26 22 16 26 18 38 C20 48 26 52 32 52 C38 52 44 48 46 38 C48 26 38 22 32 8 Z"
          fill={accent}
          opacity="0.7"
        />
      )}
      {/kamehame|galick|spirit bomb|ki blast/.test(n) && (
        <g fill={accent} opacity="0.8">
          <circle cx="32" cy="28" r="10" />
          <circle cx="32" cy="28" r="16" fill="none" stroke={accent} strokeWidth="2" />
        </g>
      )}
      {/getsuga|bankai|slash/.test(n) && (
        <path d="M14 42 L32 10 L50 42 L32 34 Z" fill={accent} opacity="0.75" />
      )}
      {/heal|palm|mystical|katsuyu/.test(n) && (
        <path d="M28 14 H36 V26 H48 V34 H36 V46 H28 V34 H16 V26 H28 Z" fill={accent} opacity="0.8" />
      )}
      {/shadow|bind|neck/.test(n) && (
        <path d="M10 46 Q32 10 54 46 Q32 34 10 46" fill={accent} opacity="0.7" />
      )}
      {/clone|feint|dodge/.test(n) && (
        <g fill="none" stroke={accent} strokeWidth="2.4" opacity="0.85">
          <path d="M18 32 H34 M34 32 L28 26 M34 32 L28 38" />
          <path d="M38 20 L48 32 L38 44" />
        </g>
      )}
      <text
        x="32"
        y="58"
        textAnchor="middle"
        fill={accent}
        fontSize="11"
        fontWeight="900"
        opacity="0.9"
        style={{ fontFamily: 'serif' }}
      >
        {mark}
      </text>
    </svg>
  );
}
