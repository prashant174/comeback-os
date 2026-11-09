import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, Progress, Segmented } from '@/components/ui/kit';
import { addDays, prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Goal } from '@/types';

const FIELDS: FieldDef[] = [
  { name: 'title', label: 'Goal', type: 'text', required: true, max: 120, full: true },
  { name: 'horizon', label: 'Horizon', type: 'select', numeric: true, options: [{ value: '30', label: '30 days' }, { value: '60', label: '60 days' }, { value: '90', label: '90 days' }] },
  { name: 'priority', label: 'Priority', type: 'select', options: [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }] },
  { name: 'category', label: 'Area', type: 'select', options: ['fitness', 'learning', 'finance', 'grooming', 'sleep', 'career', 'personal'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'paused', label: 'Paused' }, { value: 'dropped', label: 'Dropped' }] },
  { name: 'startDate', label: 'Start', type: 'date', required: true },
  { name: 'deadline', label: 'Deadline', type: 'date', required: true },
  { name: 'description', label: 'Why it matters', type: 'textarea', max: 1000 },
  { name: 'progress', label: 'Progress % (used only if there are no milestones)', type: 'number', min: 0, max: 100, full: true },
];
const PRI = { high: 'danger', medium: 'amber', low: 'neutral' } as const;

function GoalCard({ g, today, onEdit, onDelete }: { g: Goal; today: string; onEdit: () => void; onDelete: () => void }) {
  const qc = useQueryClient();
  const [ms, setMs] = useState('');
  const save = useMutation({
    mutationFn: (milestones: Goal['milestones']) => api.patch(`/goals/${g._id}`, { milestones }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/goals'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const daysLeft = Math.round((Date.parse(g.deadline) - Date.parse(today)) / 86400000);
  const strip = (m: Goal['milestones'][number]) => ({ _id: m._id, title: m.title, done: m.done, dueDate: m.dueDate ?? null });
  return (
    <section className={cn('panel p-5', g.status !== 'active' && 'opacity-70')}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">{g.title}</h3>
          <div className="flex flex-wrap gap-1.5 mt-2"><Chip tone={PRI[g.priority]}>{g.priority}</Chip><Chip>{g.horizon} days</Chip><Chip>{g.category}</Chip>{g.status !== 'active' && <Chip tone={g.status === 'completed' ? 'leaf' : 'neutral'}>{g.status}</Chip>}</div>
        </div>
        <Button variant="ghost" size="icon" aria-label={`Edit ${g.title}`} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${g.title}`} onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-3 mt-4"><Progress value={g.progress} className="flex-1" label={`${g.title} progress`} /><span className="text-sm font-semibold num">{g.progress}%</span></div>
      <p className={cn('text-xs mt-1.5', daysLeft < 0 && g.status === 'active' ? 'text-danger' : 'text-muted')}>
        {g.status === 'active' ? (daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days overdue`) : ''} · due {prettyDate(g.deadline, { day: 'numeric', month: 'short' })}
      </p>
      <ul className="mt-4 space-y-1">
        {g.milestones.map((m, i) => (
          <li key={m._id ?? i} className="flex items-center gap-2.5 group">
            <button onClick={() => save.mutate(g.milestones.map((x, j) => strip(j === i ? { ...x, done: !x.done } : x)))} aria-pressed={m.done} aria-label={`${m.done ? 'Unmark' : 'Mark'} ${m.title}`}
              className={cn('h-5 w-5 rounded-md border-2 grid place-items-center shrink-0', m.done ? 'bg-leaf border-leaf text-white dark:text-[#06140D]' : 'border-line hover:border-leaf')}>{m.done && <Check className="h-3 w-3" strokeWidth={3} />}</button>
            <span className={cn('text-sm flex-1 py-0.5', m.done && 'line-through text-muted')}>{m.title}</span>
            <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted" aria-label={`Remove ${m.title}`} onClick={() => save.mutate(g.milestones.filter((_, j) => j !== i).map(strip))}><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); if (ms.trim()) { save.mutate([...g.milestones.map(strip), { title: ms.trim(), done: false, dueDate: null }]); setMs(''); } }}>
        <Input value={ms} onChange={(e) => setMs(e.target.value)} placeholder="Add milestone" className="h-8" aria-label="New milestone" maxLength={120} />
        <Button size="sm" variant="outline" type="submit">Add</Button>
      </form>
    </section>
  );
}

export default function GoalsPage() {
  const today = useToday();
  const [status, setStatus] = useState('active');
  const [horizon, setHorizon] = useState('');
  const list = useList<Goal>('/goals', { status: status || undefined, horizon: horizon || undefined, limit: 100 });
  const m = useResourceMutations<Goal>('/goals', { noun: 'Goal' });
  const [edit, setEdit] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Goal | null>(null);
  return (
    <div>
      <PageHeader title="Goals" subtitle="30, 60 and 90-day goals broken into milestones." actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New goal</Button>} />
      <div className="flex flex-wrap gap-3 mb-5">
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ v: 'active', label: 'Active' }, { v: 'completed', label: 'Completed' }, { v: '', label: 'All' }]} />
        <Select value={horizon} onChange={(e) => setHorizon(e.target.value)} className="w-36" aria-label="Horizon"><option value="">All horizons</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></Select>
      </div>
      {list.isLoading ? <Skeleton className="h-60" /> : !list.data?.items.length ? (
        <EmptyState icon={<Target className="h-6 w-6" />} title="No goals here" body="A good goal has a deadline and 2–4 milestones you can tick off." action={<Button onClick={() => { setEdit(null); setOpen(true); }}>Create a goal</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {list.data.items.map((g) => <GoalCard key={g._id} g={g} today={today} onEdit={() => { setEdit(g); setOpen(true); }} onDelete={() => setDel(g)} />)}
        </div>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit goal' : 'New goal'} fields={FIELDS} submitLabel={edit ? 'Save goal' : 'Create goal'}
        initial={edit ?? { horizon: 30, priority: 'medium', category: 'personal', status: 'active', startDate: today, deadline: addDays(today, 30), progress: 0 }}
        onSubmit={(v) => { const body = { ...v, progress: v.progress ?? 0 }; return edit ? m.update.mutateAsync({ id: edit._id, body }) : m.create.mutateAsync(body); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.title}”?`} description="Consider marking it dropped instead to keep the history." confirmLabel="Delete goal" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}
