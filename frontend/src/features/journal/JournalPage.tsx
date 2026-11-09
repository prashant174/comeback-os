import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, NotebookPen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { get } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, Panel } from '@/components/ui/kit';
import { addMonths, monthLabel, prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { JournalEntry } from '@/types';

const MOODS = ['', '😞', '😕', '😐', '🙂', '😄'];
const MOOD_LABEL = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];
const MOOD_BG = ['', 'bg-danger/70', 'bg-amber/60', 'bg-muted/40', 'bg-leaf/60', 'bg-leaf'];

type Draft = Omit<JournalEntry, '_id' | 'tags'> & { tags: string };
const empty = (date: string): Draft => ({ date, mood: 3, achievements: '', challenges: '', reflection: '', ideas: '', tags: '' });

function Editor({ open, onOpenChange, entry, date }: { open: boolean; onOpenChange: (o: boolean) => void; entry: JournalEntry | null; date: string }) {
  const m = useResourceMutations<JournalEntry>('/journal', { noun: 'Entry', invalidate: [['journal-tags'], ['journal-month']] });
  const [d, setD] = useState<Draft>(empty(date));
  useEffect(() => { if (open) setD(entry ? { ...entry, tags: entry.tags.join(', ') } : empty(date)); }, [open, entry, date]);
  const save = async () => {
    const body = { ...d, tags: d.tags.split(',').map((t) => t.trim()).filter(Boolean) };
    if (entry) await m.update.mutateAsync({ id: entry._id, body }); else await m.create.mutateAsync(body);
    onOpenChange(false);
  };
  const area = (k: keyof Draft, label: string, ph: string, rows = 3) => (
    <div><label className="field-label" htmlFor={`j-${k}`}>{label}</label>
      <textarea id={`j-${k}`} rows={rows} value={d[k] as string} placeholder={ph} onChange={(e) => setD({ ...d, [k]: e.target.value })}
        className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-leaf" /></div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={entry ? 'Edit entry' : 'New journal entry'} className="sm:w-[min(96vw,640px)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div><label className="field-label" htmlFor="j-date">Date</label><Input id="j-date" type="date" className="mt-1.5 w-44" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></div>
          <fieldset><legend className="field-label mb-1.5">Mood</legend>
            <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-pressed={d.mood === n} aria-label={MOOD_LABEL[n]} title={MOOD_LABEL[n]} onClick={() => setD({ ...d, mood: n })}
                className={cn('h-10 w-10 rounded-xl text-xl border-2', d.mood === n ? 'border-leaf bg-leaf-soft' : 'border-transparent hover:bg-sunken')}>{MOODS[n]}</button>
            ))}</div>
          </fieldset>
        </div>
        {area('achievements', 'Wins today', 'What went well, however small?')}
        {area('challenges', 'Challenges', 'What was hard? What got in the way?')}
        {area('reflection', 'Reflection', 'Anything on your mind…', 5)}
        {area('ideas', 'Ideas', 'Project ideas, things to try…', 2)}
        <div><label className="field-label" htmlFor="j-tags">Tags</label><Input id="j-tags" className="mt-1.5" value={d.tags} placeholder="work, fitness, learning" onChange={(e) => setD({ ...d, tags: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={save} loading={m.create.isPending || m.update.isPending}>{entry ? 'Save entry' : 'Save to journal'}</Button></div>
      </div>
    </Dialog>
  );
}

function MonthCalendar({ month, setMonth, onPick }: { month: string; setMonth: (m: string) => void; onPick: (d: string) => void }) {
  const [y, mo] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const q = useQuery({ queryKey: ['journal-month', month], queryFn: () => get<JournalEntry[]>('/journal', { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, limit: 200 }) });
  const byDate = new Map<string, number[]>();
  for (const e of q.data ?? []) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.mood]);
  const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  return (
    <Panel title={monthLabel(month)} action={<div className="flex"><Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button></div>}>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted mb-1">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: last }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const moods = byDate.get(date);
          const avg = moods ? Math.round(moods.reduce((s, x) => s + x, 0) / moods.length) : 0;
          return (
            <button key={date} onClick={() => onPick(date)} title={moods ? `${moods.length} entr${moods.length > 1 ? 'ies' : 'y'} · ${MOOD_LABEL[avg]}` : 'No entry'}
              className={cn('aspect-square rounded-lg text-xs num grid place-items-center', moods ? `${MOOD_BG[avg]} text-white font-semibold` : 'bg-sunken text-muted hover:bg-line')}>{i + 1}</button>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-3">Colour shows the day's mood. Tap a day to filter.</p>
    </Panel>
  );
}

export default function JournalPage() {
  const today = useToday();
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState(today.slice(0, 7));
  const list = useList<JournalEntry>('/journal', { q: q || undefined, tags: tag || undefined, from: day || undefined, to: day || undefined, limit: 50 });
  const tags = useQuery({ queryKey: ['journal-tags'], queryFn: () => get<string[]>('/journal/tags') });
  const m = useResourceMutations<JournalEntry>('/journal', { noun: 'Entry', invalidate: [['journal-month'], ['journal-tags']] });
  const [edit, setEdit] = useState<JournalEntry | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<JournalEntry | null>(null);
  return (
    <div>
      <PageHeader title="Journal" subtitle="A few honest lines a day." actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Write today</Button>} />
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 text-muted absolute left-3 top-3" /><Input className="pl-9" placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search entries" /></div>
            <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-40" aria-label="Filter by tag"><option value="">All tags</option>{tags.data?.map((t) => <option key={t} value={t}>#{t}</option>)}</Select>
            {day && <Button variant="outline" onClick={() => setDay('')}>{prettyDate(day, { day: 'numeric', month: 'short' })} ✕</Button>}
          </div>
          {list.isLoading ? <Skeleton className="h-60" /> : !list.data?.items.length ? (
            <EmptyState icon={<NotebookPen className="h-6 w-6" />} title={q || tag || day ? 'No matching entries' : 'Your journal is empty'} body={q || tag || day ? 'Try a different search or clear filters.' : 'Write what went well and what was hard. Patterns show up after a week or two.'} />
          ) : list.data.items.map((e) => (
            <article key={e._id} className="panel p-5">
              <div className="flex items-start gap-3">
                <span className="text-2xl" role="img" aria-label={MOOD_LABEL[e.mood]}>{MOODS[e.mood]}</span>
                <div className="flex-1"><p className="font-semibold">{prettyDate(e.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p><div className="flex flex-wrap gap-1 mt-1">{e.tags.map((t) => <Chip key={t}>#{t}</Chip>)}</div></div>
                <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => setDel(e)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <dl className="mt-3 space-y-2.5 text-sm max-w-prose">
                {([['Wins', e.achievements], ['Challenges', e.challenges], ['Reflection', e.reflection], ['Ideas', e.ideas]] as const).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="whitespace-pre-wrap leading-relaxed">{v}</dd></div>
                ))}
              </dl>
            </article>
          ))}
        </div>
        <MonthCalendar month={month} setMonth={setMonth} onPick={setDay} />
      </div>
      <Editor open={open} onOpenChange={setOpen} entry={edit} date={today} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this entry?" description="This can't be undone." confirmLabel="Delete entry" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}
