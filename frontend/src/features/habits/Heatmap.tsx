import { cn } from '@/lib/utils';
import { prettyDate } from '@/lib/date';

type Cell = { date: string; scheduled: number; done: number; ratio: number };

const level = (c: Cell) => (c.scheduled === 0 ? -1 : c.ratio === 0 ? 0 : c.ratio < 0.34 ? 1 : c.ratio < 0.67 ? 2 : c.ratio < 1 ? 3 : 4);
const CLS = ['bg-sunken', 'bg-leaf/25', 'bg-leaf/50', 'bg-leaf/75', 'bg-leaf'];

/** GitHub-style grid: columns are weeks (Mon→Sun rows). */
export function Heatmap({ data }: { data: Cell[] }) {
  if (!data.length) return null;
  const firstDow = (new Date(data[0].date + 'T00:00:00').getDay() + 6) % 7; // Monday = 0
  const cells: (Cell | null)[] = [...Array(firstDow).fill(null), ...data];
  const weeks: (Cell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const c = w[di];
              if (!c) return <span key={di} className="h-3.5 w-3.5" />;
              const l = level(c);
              return (
                <span key={di} title={`${prettyDate(c.date, { day: 'numeric', month: 'short' })}: ${c.done}/${c.scheduled}`}
                  className={cn('h-3.5 w-3.5 rounded-[4px]', l < 0 ? 'bg-sunken/50' : CLS[l])} />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted">
        Less {CLS.map((c) => <span key={c} className={cn('h-3 w-3 rounded-[3px]', c)} />)} More
      </div>
    </div>
  );
}
