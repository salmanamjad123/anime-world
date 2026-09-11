import type { EnergyCost, EnergyId } from '@/types/game';
import { ENERGY_META } from '@/lib/game/roster';
import { cn } from '@/lib/utils';

const SHAPE_PATH: Record<EnergyId, string> = {
  strike: 'M8 1 L15 8 L8 15 L1 8 Z',
  tide: 'M1 8 Q4 3 8 8 Q12 13 15 8',
  pulse: 'M8 3 A5 5 0 1 1 7.9 3 Z',
  blood: 'M8 2 C8 2 14 9 8 14 C2 9 8 2 8 2 Z',
  any: 'M3 3 H13 V13 H3 Z',
};

type PipProps = {
  energy: EnergyId;
  size?: number;
  dim?: boolean;
  className?: string;
};

export function WeavePip({ energy, size = 16, dim = false, className }: PipProps) {
  const meta = ENERGY_META[energy];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={cn('shrink-0', dim && 'opacity-35', className)}
      aria-label={meta.label}
    >
      <path d={SHAPE_PATH[energy]} fill={meta.color} stroke="#f8fafc" strokeWidth="0.6" />
    </svg>
  );
}

export function WeaveCost({ cost, size = 14 }: { cost: EnergyCost; size?: number }) {
  const entries = (Object.entries(cost) as [EnergyId, number][]).filter(([, count]) => (count ?? 0) > 0);
  if (entries.length === 0) return <span className="text-[10px] text-amber-200/70">Free</span>;

  return (
    <span className="inline-flex items-center gap-0.5" title="Weave cost">
      {entries.flatMap(([energy, count]) =>
        Array.from({ length: count ?? 0 }, (_, index) => (
          <WeavePip key={`${energy}-${index}`} energy={energy} size={size} />
        ))
      )}
    </span>
  );
}
