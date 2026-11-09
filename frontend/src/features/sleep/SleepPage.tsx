import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { get } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Panel, Segmented, Stars, Stat, axisTick, chartTooltip } from '@/components/ui/kit';
import { prettyDate, shortDay, to12h } from '@/lib/date';
import type { SleepRecord } from '@/types';

type Summary = { series: { date: string; hours: number | null; quality: number | null }[]; stats: { logged: number; days: number; avgHours: number; avgQuality: number | null; bedtimeSdMin: number | null; nightsOnTarget: number; targetHours: number; targetBedtime: string | null } };

const FIELDS: FieldDef[] = [
  { name: 'date', label: 'Morning of (wake-up date)', type: 'date', required: true, full: true },
  { name: 'bedtime', label: 'Went to bed', type: 'time', required: true },
  { name: 'wakeTime', label: 'Woke up', type: 'time', required: true },
  { name: 'quality', label: 'How rested do you feel?', type: 'select', numeric: true, options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: ['', '1 · Exhausted', '2 · Tired', '3 · Okay', '4 · Good', '5 · Fully rested'][n] })) },
  { name: 'notes', label: 'Notes', type: 'text', max: 500, placeholder: 'Late screen time, woke up at 3 AM…' },
];

export default function SleepPage() {
  const today = useToday();
  const [days, setDays] = useState(14);
  const s = useQuery({ queryKey: ['sleep-summary', days], queryFn: () => get<Summary>('/sleep/summary', { days }) });
  const list = useList<SleepRecord>('/sleep', { limit: 30 });
  const m = useResourceMutations<SleepRecord>('/sleep', { noun: 'Sleep entry', invalidate: [['sleep-summary']] });
  const [edit, setEdit] = useState<SleepRecord | null>(null);
  const [open, setOpen] = useState(false);
  const st = s.data?.stats;
  const loggedToday = list.data?.items.some((r) => r.date === today);
  return (
    <div>
      <PageHeader title="Sleep" subtitle="Logged manually. Quality is how rested you feel — no wearable needed."
        actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />{loggedToday ? 'Log a night' : 'Log last night'}</Button>} />
      <div className="mb-5"><Segmented label="Range" value={days} onChange={setDays} options={[{ v: 7, label: '7 nights' }, { v: 14, label: '14 nights' }, { v: 30, label: '30 nights' }]} /></div>
      {s.isLoading || !st ? <Skeleton className="h-24" /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <Stat label="Average sleep" value={st.logged ? `${st.avgHours} h` : '—'} sub={`target ${st.targetHours} h`} />
          <Stat label="Nights on target" value={`${st.nightsOnTarget}/${st.logged}`} sub={`${st.logged} of ${st.days} nights logged`} />
          <Stat label="Bedtime consistency" value={st.bedtimeSdMin === null ? '—' : `±${st.bedtimeSdMin} min`} sub={st.targetBedtime ? `target bedtime ${to12h(st.targetBedtime)}` : 'spread of your bedtimes'} />
          <Stat label="Feeling rested" value={st.avgQuality ? `${st.avgQuality}/5` : '—'} sub="self-rated" />
        </div>
      )}
      <Panel title="Hours per night" className="mb-5">
        <div className="h-60 -ml-2"><ResponsiveContainer><BarChart data={s.data?.series ?? []}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
          <XAxis dataKey="date" tickFormatter={(d) => (days <= 14 ? shortDay(d) : prettyDate(d, { day: 'numeric' }))} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 10]} tick={axisTick} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...chartTooltip} labelFormatter={(d) => prettyDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' })} formatter={(v: number) => [`${v} h`, 'Sleep']} />
          {st?.targetHours ? <ReferenceLine y={st.targetHours} stroke="hsl(var(--muted))" strokeDasharray="4 4" /> : null}
          <Bar dataKey="hours" fill="hsl(var(--water))" radius={[6, 6, 2, 2]} maxBarSize={26} /></BarChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="Sleep log" bodyClass="px-0">
        {!list.data?.items.length ? <EmptyState icon={<Moon className="h-6 w-6" />} title="No nights logged" body="Log when you went to bed and woke up. A week of entries shows your pattern." /> : (
          <ul className="divide-y divide-line">
            {list.data.items.map((r) => (
              <li key={r._id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-20 text-sm">{prettyDate(r.date, { weekday: 'short', day: 'numeric' })}</span>
                <span className="flex-1 text-sm text-muted num">{to12h(r.bedtime)} → {to12h(r.wakeTime)}</span>
                <span className="font-semibold num text-sm">{(r.durationMin / 60).toFixed(1)} h</span>
                <Stars label="Rested" value={r.quality} />
                <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => m.remove.mutate(r._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit night' : 'Log sleep'} fields={FIELDS} submitLabel={edit ? 'Save entry' : 'Save night'}
        initial={edit ?? { date: today, bedtime: st?.targetBedtime ?? '23:00', wakeTime: '06:15', quality: 3 }}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit._id, body: v }) : m.create.mutateAsync(v)} />
    </div>
  );
}
