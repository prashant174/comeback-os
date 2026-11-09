import { cn } from '@/lib/utils';

type Ring = { key: string; label: string; ratio: number };
const tone: Record<string, string> = { habits: 'stroke-leaf', water: 'stroke-water', protein: 'stroke-amber', workout: 'stroke-danger', study: 'stroke-[hsl(265_60%_60%)]', sleep: 'stroke-[hsl(220_60%_62%)]' };
const dot: Record<string, string> = { habits: 'bg-leaf', water: 'bg-water', protein: 'bg-amber', workout: 'bg-danger', study: 'bg-[hsl(265_60%_60%)]', sleep: 'bg-[hsl(220_60%_62%)]' };

/**
 * Concentric rings — one per scored area — with the overall score in the
 * middle. All rings share a fixed outer band (about a quarter of the width),
 * so the centre stays clear for the number however many areas are scored.
 */
export function DayRing({ score, rings, size = 220 }: { score: number; rings: Ring[]; size?: number }) {
  const c = size / 2;
  const n = Math.max(1, rings.length);
  const band = Math.min(size * 0.26, n * 22); // 1–2 rings stay chunky, 6 rings get thinner
  const per = band / n;
  const stroke = per * (n > 3 ? 0.74 : 0.8);
  const gap = per - stroke;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Today's score ${score} percent`}>
        {rings.map((r, i) => {
          const radius = c - stroke / 2 - i * (stroke + gap);
          const circ = 2 * Math.PI * radius;
          const ratio = Math.min(1, Math.max(0, r.ratio));
          return (
            <g key={r.key}>
              <circle cx={c} cy={c} r={radius} fill="none" className="stroke-sunken" strokeWidth={stroke} />
              {/* round caps draw a dot even for a zero-length dash, so skip the arc at 0% */}
              {ratio > 0 && (
                <circle cx={c} cy={c} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round"
                  className={cn(tone[r.key] ?? 'stroke-amber', 'transition-[stroke-dasharray] duration-700 ease-out')}
                  strokeDasharray={`${ratio * circ} ${circ}`} transform={`rotate(-90 ${c} ${c})`} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display font-semibold num leading-none" style={{ fontSize: size * (n > 3 ? 0.2 : 0.24) }}>{score}<span className="text-muted" style={{ fontSize: size * 0.09 }}>%</span></div>
          <div className="text-xs text-muted mt-1.5">today</div>
        </div>
      </div>
    </div>
  );
}

export function RingLegend({ rings }: { rings: Ring[] }) {
  return (
    <ul className="space-y-2.5">
      {rings.map((r) => (
        <li key={r.key} className="flex items-center gap-3 text-sm">
          <span className={cn('h-2.5 w-2.5 rounded-full', dot[r.key] ?? 'bg-amber')} />
          <span className="flex-1">{r.label}</span>
          <span className="num font-medium">{Math.round(r.ratio * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}
