import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Droplet, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useWaterHistory, useWaterMutations, useWaterToday } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { apiError } from '@/lib/api';
import { shortDay } from '@/lib/date';
import { formatMl, pct } from '@/lib/utils';

/** A glass that fills — the water page's single visual idea. */
function Glass({ ratio }: { ratio: number }) {
  const h = 200 * Math.min(1, ratio);
  return (
    <svg viewBox="0 0 140 220" className="h-56 w-auto" role="img" aria-label={`${Math.round(ratio * 100)} percent of target`}>
      <defs><clipPath id="glass"><path d="M14 10 H126 L112 210 H28 Z" /></clipPath></defs>
      <path d="M14 10 H126 L112 210 H28 Z" className="fill-sunken" />
      <g clipPath="url(#glass)">
        <rect x="0" y={210 - h} width="140" height={h} className="fill-water transition-all duration-700 ease-out" />
        <rect x="0" y={210 - h} width="140" height="6" className="fill-white/25" />
      </g>
      <path d="M14 10 H126 L112 210 H28 Z" fill="none" className="stroke-line" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

export default function WaterPage() {
  const today = useWaterToday();
  const hist = useWaterHistory(14);
  const settings = useSettings();
  const { add, remove } = useWaterMutations();
  const [custom, setCustom] = useState('');
  const quick = settings.data?.preferences.waterQuickAdd ?? [150, 250, 500];

  const addCustom = () => {
    const ml = Number(custom);
    if (!Number.isInteger(ml) || ml < 1 || ml > 5000) return toast.error('Enter a whole number between 1 and 5000 ml');
    add.mutate(ml, { onSuccess: () => setCustom('') });
  };

  if (today.isError) return <ErrorState message={apiError(today.error)} onRetry={() => today.refetch()} />;
  const d = today.data;

  return (
    <div>
      <PageHeader title="Water" subtitle={d ? `${pct(d.totalMl, d.targetMl)}% of today's ${formatMl(d.targetMl)} target` : ' '} />
      <div className="grid lg:grid-cols-[360px_1fr] gap-5 items-start">
        <section className="panel p-6 flex flex-col items-center rounded-3xl">
          {!d ? <Skeleton className="h-56 w-36" /> : <Glass ratio={d.targetMl ? d.totalMl / d.targetMl : 0} />}
          <p className="font-display text-4xl font-semibold num mt-4">{d ? formatMl(d.totalMl) : '—'}</p>
          <p className="text-sm text-muted">{d && d.targetMl > d.totalMl ? `${formatMl(d.targetMl - d.totalMl)} to go` : d ? 'Target reached' : ''}</p>
          <div className="grid grid-cols-3 gap-2 w-full mt-6">
            {quick.map((ml) => (
              <Button key={ml} variant="secondary" onClick={() => add.mutate(ml)} className="bg-water-soft text-water hover:bg-water-soft hover:brightness-95">
                <Plus className="h-3.5 w-3.5" />{ml} ml
              </Button>
            ))}
          </div>
          <form className="flex gap-2 w-full mt-2" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
            <Input inputMode="numeric" placeholder="Custom ml" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} aria-label="Custom amount in ml" />
            <Button type="submit" variant="outline" loading={add.isPending}>Add</Button>
          </form>
        </section>

        <div className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <h2 className="text-base font-semibold mb-4">Last 14 days</h2>
            {hist.isLoading || !hist.data ? <Skeleton className="h-56" /> : (
              <div className="h-56 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hist.data.rows.map((r) => ({ ...r, day: shortDay(r.date) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--line))" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted))', fontSize: 11 }} interval={0} />
                    <YAxis domain={[0, (max: number) => Math.max(max, hist.data!.targetMl) * 1.05]} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}L` : v)} tickLine={false} axisLine={false} width={36} tick={{ fill: 'hsl(var(--muted))', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--sunken))' }} formatter={(v: number) => [formatMl(v), 'Water']}
                      labelFormatter={(_l, p) => p?.[0]?.payload?.date ?? ''}
                      contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--line))', borderRadius: 12, fontSize: 13 }} />
                    {hist.data.targetMl > 0 && <ReferenceLine y={hist.data.targetMl} stroke="hsl(var(--muted))" strokeDasharray="4 4" label={{ value: 'Target', position: 'insideTopLeft', fill: 'hsl(var(--muted))', fontSize: 11 }} />}
                    <Bar dataKey="totalMl" fill="hsl(var(--water))" radius={[6, 6, 2, 2]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <h2 className="text-base font-semibold px-5 sm:px-6 pt-5 pb-3">Today's log</h2>
            {!d ? <div className="p-5"><Skeleton className="h-24" /></div> : d.entries.length === 0 ? (
              <EmptyState icon={<Droplet className="h-6 w-6" />} title="No water logged today" body="Tap a quick-add button when you finish a glass." />
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {d.entries.map((e) => (
                  <li key={e._id} className="flex items-center gap-3 px-5 sm:px-6 py-2.5">
                    <Droplet className="h-4 w-4 text-water" />
                    <span className="text-sm font-medium num">{e.amountMl} ml</span>
                    <span className="text-xs text-muted ml-auto num">{new Date(e.loggedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${e.amountMl} ml`} onClick={() => remove.mutate(e._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
