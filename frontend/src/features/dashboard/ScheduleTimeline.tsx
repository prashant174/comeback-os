import { useEffect, useState } from 'react';
import { nowMinutesIn, to12h, toMinutes } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

type Item = { key: string; label: string; start: string; end?: string };

export function ScheduleTimeline({ schedule, timezone }: { schedule: Profile['schedule']; timezone: string }) {
  const [now, setNow] = useState(() => nowMinutesIn(timezone));
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutesIn(timezone)), 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  const items: Item[] = [
    { key: 'wake', label: 'Wake up', start: schedule.wakeUp },
    ...[...schedule.blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    { key: 'sleep', label: 'Sleep', start: schedule.sleep },
  ];

  const state = (it: Item) => {
    const s = toMinutes(it.start);
    const e = it.end ? toMinutes(it.end) : s + 1;
    if (now >= s && now < e) return 'now';
    return now >= e ? 'past' : 'next';
  };
  const firstUpcoming = items.findIndex((it) => state(it) === 'next');

  return (
    <ol className="relative">
      {items.map((it, i) => {
        const st = state(it);
        const isNext = i === firstUpcoming && !items.some((x) => state(x) === 'now');
        return (
          <li key={it.key + i} className="relative flex gap-4 pb-4 last:pb-0">
            {i < items.length - 1 && <span className={cn('absolute left-[5px] top-4 bottom-0 w-px', st === 'past' ? 'bg-leaf/50' : 'bg-line')} aria-hidden />}
            <span className={cn('relative mt-1.5 h-[11px] w-[11px] rounded-full border-2 shrink-0',
              st === 'now' ? 'border-leaf bg-leaf ring-4 ring-leaf/20' : st === 'past' ? 'border-leaf/60 bg-leaf/60' : 'border-line bg-surface')} />
            <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
              <span className={cn('text-sm truncate', st === 'past' && 'text-muted', st === 'now' && 'font-semibold')}>
                {it.label}
                {st === 'now' && <span className="ml-2 text-[11px] font-medium text-leaf">now</span>}
                {isNext && <span className="ml-2 text-[11px] font-medium text-muted">up next</span>}
              </span>
              <span className="text-xs text-muted num shrink-0">{to12h(it.start)}{it.end ? ` – ${to12h(it.end)}` : ''}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
