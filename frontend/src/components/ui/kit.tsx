import * as T from '@radix-ui/react-tabs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { addDays, prettyDate } from '@/lib/date';
import { Button } from './button';

export function Progress({ value, max = 100, tone = 'leaf', className, label }: { value: number; max?: number; tone?: 'leaf' | 'water' | 'amber' | 'danger'; className?: string; label?: string }) {
  const p = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bg = { leaf: 'bg-leaf', water: 'bg-water', amber: 'bg-amber', danger: 'bg-danger' }[tone];
  return (
    <div className={cn('h-2 rounded-full bg-sunken overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bg)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('panel p-4', className)}>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold num mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn('panel', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      <div className={cn(title ? 'px-5 pb-5' : 'p-5', bodyClass)}>{children}</div>
    </section>
  );
}

/** Underline tabs used at the top of module pages. */
export function PageTabs({ value, onChange, tabs, children }: { value: string; onChange: (v: string) => void; tabs: { v: string; label: string }[]; children: ReactNode }) {
  return (
    <T.Root value={value} onValueChange={onChange}>
      <T.List className="flex gap-1 border-b border-line mb-5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Sections">
        {tabs.map((t) => (
          <T.Trigger key={t.v} value={t.v}
            className="shrink-0 px-3 h-10 text-sm text-muted border-b-2 border-transparent -mb-px hover:text-ink data-[state=active]:text-ink data-[state=active]:border-leaf data-[state=active]:font-medium">
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
      {children}
    </T.Root>
  );
}
export const TabPanel = T.Content;

export function DateNav({ date, onChange, max }: { date: string; onChange: (d: string) => void; max?: string }) {
  return (
    <div className="inline-flex items-center gap-1 panel rounded-xl p-1">
      <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
      <input type="date" value={date} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label="Date"
        className="bg-transparent text-sm font-medium px-1 h-8 rounded-md" />
      <Button variant="ghost" size="icon" aria-label="Next day" disabled={!!max && date >= max} onClick={() => onChange(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
      {max && date !== max && <Button variant="ghost" size="sm" onClick={() => onChange(max)}>Today</Button>}
    </div>
  );
}
export const dateTitle = (d: string, today: string) => (d === today ? 'Today' : prettyDate(d, { weekday: 'short', day: 'numeric', month: 'short' }));

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'leaf' | 'amber' | 'danger' | 'water'; className?: string }) {
  const t = { neutral: 'bg-sunken text-muted', leaf: 'bg-leaf-soft text-leaf-ink', amber: 'bg-amber/15 text-amber', danger: 'bg-danger-soft text-danger', water: 'bg-water-soft text-water' }[tone];
  return <span className={cn('inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs font-medium whitespace-nowrap', t, className)}>{children}</span>;
}

export function Segmented<T extends string | number>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex panel rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button key={String(o.v)} role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}
          className={cn('h-8 px-3 rounded-lg text-sm', value === o.v ? 'bg-leaf-soft text-leaf-ink font-medium' : 'text-muted hover:text-ink')}>{o.label}</button>
      ))}
    </div>
  );
}

export function Stars({ value, onChange, label, max = 5 }: { value: number; onChange?: (v: number) => void; label: string; max?: number }) {
  return (
    <div className="inline-flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i + 1 === value ? 0 : i + 1)} aria-label={`${i + 1}`}
          className={cn('h-5 w-5 rounded-full border-2', i < value ? 'bg-leaf border-leaf' : 'border-line', onChange && 'hover:border-leaf')} />
      ))}
    </div>
  );
}

export const chartTooltip = { contentStyle: { background: 'hsl(var(--surface))', border: '1px solid hsl(var(--line))', borderRadius: 12, fontSize: 13 }, labelStyle: { color: 'hsl(var(--ink))', fontWeight: 600 } };
export const axisTick = { fill: 'hsl(var(--muted))', fontSize: 11 };
