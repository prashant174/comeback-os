import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Heart, Pencil, Plus, Shirt, Trash2 } from 'lucide-react';
import { apiError } from '@/lib/api';
import { get, post } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, PageTabs, Panel, Progress, TabPanel } from '@/components/ui/kit';
import { DAY_SHORT, addDays, prettyDate, weekdayOf } from '@/lib/date';
import { cn, formatINR } from '@/lib/utils';
import type { ClothingItem, FinanceSummary, GroomingTask, Outfit } from '@/types';

type Today = { date: string; items: GroomingTask[]; week: { date: string; done: number }[] };
const freqLabel = (t: GroomingTask) => t.frequency === 'daily' ? 'Daily' : t.frequency === 'weekly' ? t.daysOfWeek.map((d) => DAY_SHORT[d]).join(', ') : `Every ${t.intervalDays} days`;

const TASK_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Task', type: 'text', required: true, max: 80, full: true },
  { name: 'category', label: 'Category', type: 'select', options: ['skincare', 'hair', 'beard', 'dental', 'clothing', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'frequency', label: 'Repeat', type: 'select', options: [{ value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Weekly on…' }, { value: 'interval', label: 'Every N days' }] },
  { name: 'daysOfWeek', label: 'Days (for weekly)', type: 'days' },
  { name: 'intervalDays', label: 'Every N days (for interval)', type: 'number', min: 1, max: 365 },
];

function ChecklistTab() {
  const today = useToday();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['grooming-today'], queryFn: () => get<Today>('/grooming/today') });
  const m = useResourceMutations<GroomingTask>('/grooming/tasks', { noun: 'Task', invalidate: [['grooming-today']] });
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => post(`/grooming/tasks/${id}/log`, { done }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['grooming-today'] }),
    onError: (e) => toast.error(apiError(e)),
  });
  const [edit, setEdit] = useState<GroomingTask | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<GroomingTask | null>(null);
  if (q.isLoading || !q.data) return <Skeleton className="h-64" />;
  const due = q.data.items.filter((t) => t.due);
  const upcoming = q.data.items.filter((t) => !t.due);
  const done = due.filter((t) => t.doneToday).length;
  const Row = ({ t }: { t: GroomingTask }) => (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <button disabled={!t.due} onClick={() => toggle.mutate({ id: t._id, done: !t.doneToday })} aria-pressed={t.doneToday} aria-label={`${t.doneToday ? 'Unmark' : 'Mark'} ${t.title}`}
        className={cn('h-6 w-6 rounded-lg border-2 grid place-items-center shrink-0 disabled:opacity-40', t.doneToday ? 'bg-leaf border-leaf text-white dark:text-[#06140D]' : 'border-line hover:border-leaf')}>
        {t.doneToday && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', t.doneToday && 'line-through text-muted')}>{t.title}</p>
        <p className="text-xs text-muted">{freqLabel(t)}{t.frequency === 'interval' && t.nextDue && !t.due ? ` · next ${prettyDate(t.nextDue, { day: 'numeric', month: 'short' })}` : ''}{t.lastDone ? ` · last ${prettyDate(t.lastDone, { day: 'numeric', month: 'short' })}` : ''}</p>
      </div>
      <Chip>{t.category}</Chip>
      <Button variant="ghost" size="icon" aria-label={`Edit ${t.title}`} onClick={() => { setEdit(t); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
      <Button variant="ghost" size="icon" aria-label={`Delete ${t.title}`} onClick={() => setDel(t)}><Trash2 className="h-4 w-4 text-muted" /></Button>
    </li>
  );
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
      <div className="space-y-5">
        <Panel title={`Due today · ${done}/${due.length}`} action={<Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New task</Button>} bodyClass="px-0">
          <ul className="divide-y divide-line">{due.map((t) => <Row key={t._id} t={t} />)}</ul>
        </Panel>
        {upcoming.length > 0 && <Panel title="Not due today" bodyClass="px-0"><ul className="divide-y divide-line">{upcoming.map((t) => <Row key={t._id} t={t} />)}</ul></Panel>}
      </div>
      <Panel title="This week">
        <ul className="space-y-2">
          {q.data.week.map((w) => (
            <li key={w.date} className="flex items-center gap-3 text-sm">
              <span className={cn('w-10', w.date === today && 'font-semibold')}>{DAY_SHORT[weekdayOf(w.date)]}</span>
              <Progress value={w.done} max={Math.max(due.length, 1)} className="flex-1" label={`${w.date} tasks done`} />
              <span className="w-6 text-right num text-muted text-xs">{w.done}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit task' : 'New grooming task'} fields={TASK_FIELDS} initial={edit ?? { daysOfWeek: [0], intervalDays: 30 }} submitLabel={edit ? 'Save task' : 'Add task'}
        onSubmit={(v) => { const body = { ...v, intervalDays: v.intervalDays ?? 30 }; return edit ? m.update.mutateAsync({ id: edit._id, body }) : m.create.mutateAsync(body); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.title}”?`} description="Its history is removed too." confirmLabel="Delete task" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}

const CLOTH_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Item', type: 'text', required: true, max: 80, full: true },
  { name: 'category', label: 'Type', type: 'select', options: ['top', 'shirt', 't-shirt', 'trousers', 'jeans', 'shoes', 'jacket', 'accessory', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'color', label: 'Colour', type: 'text', max: 30 },
  { name: 'condition', label: 'Condition', type: 'select', options: [{ value: 'new', label: 'New' }, { value: 'good', label: 'Good' }, { value: 'worn', label: 'Worn' }, { value: 'replace', label: 'Needs replacing' }] },
  { name: 'price', label: 'Price (₹)', type: 'number', min: 0, max: 1000000 },
  { name: 'priority', label: 'Priority (wishlist)', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { name: 'wishlist', label: 'On my wishlist (not owned yet)', type: 'checkbox', full: true },
];
function WardrobeTab() {
  const today = useToday();
  const owned = useList<ClothingItem>('/grooming/clothing', { wishlist: 'false', limit: 200 });
  const wish = useList<ClothingItem>('/grooming/clothing', { wishlist: 'true', limit: 200 });
  const fin = useQuery({ queryKey: ['finance-summary', today.slice(0, 7)], queryFn: () => get<FinanceSummary>('/finance/summary', { month: today.slice(0, 7) }) });
  const m = useResourceMutations<ClothingItem>('/grooming/clothing', { noun: 'Item' });
  const [edit, setEdit] = useState<ClothingItem | null>(null);
  const [open, setOpen] = useState(false);
  const [wishDefault, setWishDefault] = useState(false);
  const clothing = fin.data?.categories.find((c) => c.name.toLowerCase().includes('cloth'));
  const wishTotal = (wish.data?.items ?? []).reduce((s, i) => s + i.price, 0);
  const Card = ({ i }: { i: ClothingItem }) => (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <div className="flex-1 min-w-0"><p className="text-sm truncate">{i.name}</p><p className="text-xs text-muted">{[i.category, i.color].filter(Boolean).join(' · ')}{i.price ? ` · ${formatINR(i.price)}` : ''}</p></div>
      {i.wishlist ? <Chip tone={i.priority === 'high' ? 'danger' : i.priority === 'medium' ? 'amber' : 'neutral'}>{i.priority}</Chip> : <Chip tone={i.condition === 'replace' ? 'danger' : i.condition === 'worn' ? 'amber' : 'neutral'}>{i.condition}</Chip>}
      {i.wishlist && <Button size="sm" variant="ghost" onClick={() => m.update.mutate({ id: i._id, body: { wishlist: false, condition: 'new' } })}>Bought</Button>}
      <Button variant="ghost" size="icon" aria-label={`Edit ${i.name}`} onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
      <Button variant="ghost" size="icon" aria-label={`Delete ${i.name}`} onClick={() => m.remove.mutate(i._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
    </li>
  );
  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <Panel title={`Wardrobe · ${owned.data?.items.length ?? 0}`} action={<Button size="sm" onClick={() => { setEdit(null); setWishDefault(false); setOpen(true); }}><Plus className="h-4 w-4" />Add item</Button>} bodyClass="px-0">
        {!owned.data?.items.length ? <EmptyState icon={<Shirt className="h-6 w-6" />} title="Wardrobe is empty" body="Add what you own to plan outfits and spot gaps." /> : <ul className="divide-y divide-line">{owned.data.items.map((i) => <Card key={i._id} i={i} />)}</ul>}
      </Panel>
      <div className="space-y-5">
        {clothing && (
          <Panel title="Clothing budget this month">
            <p className="font-display text-2xl font-semibold num">{formatINR(clothing.spent, 2)}<span className="text-muted text-base"> / {formatINR(clothing.limit)}</span></p>
            <Progress value={clothing.spent} max={clothing.limit || 1} tone={(clothing.pct ?? 0) >= 100 ? 'danger' : 'leaf'} className="mt-2" label="Clothing budget" />
            <p className="text-xs text-muted mt-2">Wishlist total {formatINR(wishTotal)}. Log purchases in Finance under the clothing category.</p>
          </Panel>
        )}
        <Panel title={`Shopping wishlist · ${wish.data?.items.length ?? 0}`} action={<Button size="sm" variant="outline" onClick={() => { setEdit(null); setWishDefault(true); setOpen(true); }}><Heart className="h-4 w-4" />Add wish</Button>} bodyClass="px-0">
          {!wish.data?.items.length ? <p className="text-sm text-muted px-5">Nothing on your wishlist.</p> : <ul className="divide-y divide-line">{wish.data.items.map((i) => <Card key={i._id} i={i} />)}</ul>}
        </Panel>
      </div>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit item' : wishDefault ? 'Add to wishlist' : 'Add clothing item'} fields={CLOTH_FIELDS}
        initial={edit ?? { wishlist: wishDefault, condition: wishDefault ? 'new' : 'good', price: 0 }} submitLabel={edit ? 'Save item' : 'Add item'}
        onSubmit={(v) => { const body = { ...v, price: v.price ?? 0 }; return edit ? m.update.mutateAsync({ id: edit._id, body }) : m.create.mutateAsync(body); }} />
    </div>
  );
}

function OutfitsTab() {
  const today = useToday();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const outfits = useList<Outfit>('/grooming/outfits', { from: days[0], to: days[6] });
  const clothes = useList<ClothingItem>('/grooming/clothing', { wishlist: 'false', limit: 200 });
  const m = useResourceMutations<Outfit>('/grooming/outfits', { noun: 'Outfit' });
  const byDate = new Map(outfits.data?.items.map((o) => [o.date, o]));
  const items = clothes.data?.items ?? [];
  const setItems = (date: string, ids: string[]) => {
    const o = byDate.get(date);
    if (o) m.update.mutate({ id: o._id, body: { items: ids } }); else m.create.mutate({ date, items: ids });
  };
  if (!items.length && !clothes.isLoading) return <EmptyState icon={<Shirt className="h-6 w-6" />} title="Add clothes first" body="The outfit planner picks from your wardrobe." />;
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {days.map((d) => {
        const o = byDate.get(d);
        const chosen = o?.items ?? [];
        return (
          <section key={d} className="panel p-4">
            <p className="text-sm font-semibold">{d === today ? 'Today' : prettyDate(d, { weekday: 'long' })}</p>
            <p className="text-xs text-muted mb-3">{prettyDate(d, { day: 'numeric', month: 'short' })}</p>
            <ul className="space-y-1.5 mb-3">
              {chosen.map((id) => { const c = items.find((x) => x._id === id); return c ? (
                <li key={id} className="flex items-center gap-2 text-sm"><span className="flex-1 truncate">{c.name}</span><button aria-label={`Remove ${c.name}`} onClick={() => setItems(d, chosen.filter((x) => x !== id))} className="text-muted"><Trash2 className="h-3.5 w-3.5" /></button></li>
              ) : null; })}
              {!chosen.length && <li className="text-xs text-muted">No outfit planned</li>}
            </ul>
            <Select value="" onChange={(e) => e.target.value && setItems(d, [...chosen, e.target.value])} className="h-8 text-xs" aria-label="Add clothing item">
              <option value="">+ Add item</option>
              {items.filter((c) => !chosen.includes(c._id)).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </section>
        );
      })}
    </div>
  );
}

function HistoryTab() {
  const q = useQuery({ queryKey: ['grooming-history'], queryFn: () => get<{ _id: string; date: string; task: { title: string; category: string } | null }[]>('/grooming/history') });
  const groups = Object.entries((q.data ?? []).reduce<Record<string, string[]>>((a, l) => { (a[l.date] ??= []).push(l.task?.title ?? 'Deleted task'); return a; }, {}));
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!groups.length) return <p className="text-sm text-muted">No grooming history yet.</p>;
  return (
    <Panel bodyClass="px-0">
      <ul className="divide-y divide-line">{groups.map(([date, titles]) => (
        <li key={date} className="px-5 py-3"><p className="text-sm font-medium">{prettyDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} <span className="text-muted font-normal">· {titles.length}</span></p><p className="text-sm text-muted mt-0.5">{titles.join(', ')}</p></li>
      ))}</ul>
    </Panel>
  );
}

export default function GroomingPage() {
  const [tab, setTab] = useState('today');
  return (
    <div>
      <PageHeader title="Grooming & style" subtitle="Small daily care, a wardrobe that fits." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'today', label: 'Checklist' }, { v: 'wardrobe', label: 'Wardrobe & wishlist' }, { v: 'outfits', label: 'Outfit planner' }, { v: 'history', label: 'History' }]}>
        <TabPanel value="today"><ChecklistTab /></TabPanel>
        <TabPanel value="wardrobe"><WardrobeTab /></TabPanel>
        <TabPanel value="outfits"><OutfitsTab /></TabPanel>
        <TabPanel value="history"><HistoryTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
