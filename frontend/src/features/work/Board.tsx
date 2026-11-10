import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckSquare, GripVertical, Plus, Trash2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { get } from '@/lib/resource';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import type { TaskStatus, WorkTask } from '@/types';
import { DueChip, PRIORITY_OPTS, PriorityChip, TASK_STATUS, nullify, projectNameOf, projectOptions, useProjects, useWorkInvalidate } from './shared';

type Draft = { title: string; description: string; project: string; status: TaskStatus; blockedReason: string; priority: string; dueDate: string; estimateHours: string; assignee: string; checklist: { title: string; done: boolean }[] };
const blank = (status: TaskStatus = 'todo', project = ''): Draft => ({ title: '', description: '', project, status, blockedReason: '', priority: 'medium', dueDate: '', estimateHours: '', assignee: 'me', checklist: [] });

export function TaskDialog({ open, onOpenChange, task, defaults }: { open: boolean; onOpenChange: (o: boolean) => void; task: WorkTask | null; defaults?: Partial<Draft> }) {
  const projects = useProjects();
  const invalidate = useWorkInvalidate();
  const [d, setD] = useState<Draft>(blank());
  const [newItem, setNewItem] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    if (!open) return;
    setD(task ? {
      title: task.title, description: task.description, project: typeof task.project === 'string' ? task.project : task.project?._id ?? '', status: task.status,
      blockedReason: task.blockedReason, priority: task.priority, dueDate: task.dueDate ?? '', estimateHours: task.estimateHours?.toString() ?? '', assignee: task.assignee || 'me',
      checklist: task.checklist.map((c) => ({ title: c.title, done: c.done })),
    } : { ...blank(), ...defaults });
    setNewItem('');
  }, [open, task, defaults]);

  const save = useMutation({
    mutationFn: () => {
      const body = nullify({ ...d, estimateHours: d.estimateHours === '' ? null : Number(d.estimateHours) }, ['project', 'dueDate']);
      if (body.status !== 'blocked') delete body.blockedReason;
      return task ? api.patch(`/work/tasks/${task._id}`, body) : api.post('/work/tasks', body);
    },
    onSuccess: () => { invalidate(); toast.success(task ? 'Task saved' : 'Task added'); onOpenChange(false); },
    onError: (e) => toast.error(apiError(e)),
  });
  const del = useMutation({ mutationFn: () => api.delete(`/work/tasks/${task!._id}`), onSuccess: () => { invalidate(); setConfirmDel(false); onOpenChange(false); toast.success('Task deleted'); } });
  const set = (k: keyof Draft, v: unknown) => setD((x) => ({ ...x, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={task ? 'Edit task' : 'New task'} className="sm:w-[min(96vw,620px)]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!d.title.trim()) return toast.error('Give the task a title'); save.mutate(); }}>
        <Field label="Title" htmlFor="t-title"><Input id="t-title" autoFocus value={d.title} maxLength={200} onChange={(e) => set('title', e.target.value)} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Project" htmlFor="t-proj"><Select id="t-proj" value={d.project} onChange={(e) => set('project', e.target.value)}>{projectOptions(projects.data?.items).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Status" htmlFor="t-status"><Select id="t-status" value={d.status} onChange={(e) => set('status', e.target.value)}>{Object.entries(TASK_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        </div>
        {d.status === 'blocked' && (
          <Field label="What's blocking it?" htmlFor="t-block"><Input id="t-block" value={d.blockedReason} maxLength={300} placeholder="Waiting for data access from IT…" onChange={(e) => set('blockedReason', e.target.value)} /></Field>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Priority" htmlFor="t-pri"><Select id="t-pri" value={d.priority} onChange={(e) => set('priority', e.target.value)}>{PRIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          <Field label="Due" htmlFor="t-due"><Input id="t-due" type="date" value={d.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          <Field label="Est. hours" htmlFor="t-est"><Input id="t-est" type="number" min={0} step="0.5" value={d.estimateHours} onChange={(e) => set('estimateHours', e.target.value)} /></Field>
          <Field label="Owner" htmlFor="t-own"><Input id="t-own" value={d.assignee} maxLength={60} onChange={(e) => set('assignee', e.target.value)} /></Field>
        </div>
        <Field label="Notes (optional)" htmlFor="t-desc">
          <textarea id="t-desc" rows={3} value={d.description} maxLength={3000} onChange={(e) => set('description', e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-leaf" />
        </Field>
        <fieldset>
          <legend className="field-label mb-1.5">Checklist</legend>
          <ul className="space-y-1">
            {d.checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--leaf))]" checked={c.done} onChange={() => set('checklist', d.checklist.map((x, j) => j === i ? { ...x, done: !x.done } : x))} aria-label={c.title} />
                <span className={cn('flex-1 text-sm', c.done && 'line-through text-muted')}>{c.title}</span>
                <button type="button" aria-label={`Remove ${c.title}`} onClick={() => set('checklist', d.checklist.filter((_, j) => j !== i))} className="text-muted"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-2">
            <Input className="h-9" placeholder="Add checklist item" value={newItem} maxLength={200} onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (newItem.trim()) { set('checklist', [...d.checklist, { title: newItem.trim(), done: false }]); setNewItem(''); } } }} aria-label="New checklist item" />
            <Button type="button" size="sm" variant="outline" onClick={() => { if (newItem.trim()) { set('checklist', [...d.checklist, { title: newItem.trim(), done: false }]); setNewItem(''); } }}>Add</Button>
          </div>
        </fieldset>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-1">
          {task ? <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmDel(true)}><Trash2 className="h-4 w-4" />Delete</Button> : <span />}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{task ? 'Save task' : 'Add task'}</Button>
          </div>
        </div>
      </form>
      <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} title="Delete this task?" description="Linked requirements and meeting items are kept and can get a new task." confirmLabel="Delete task" loading={del.isPending} onConfirm={() => del.mutate()} />
    </Dialog>
  );
}

const COLS: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
const COL_TONE: Record<TaskStatus, string> = { todo: 'bg-muted/40', in_progress: 'bg-water', blocked: 'bg-danger', done: 'bg-leaf' };

export default function Board() {
  const projects = useProjects();
  const invalidate = useWorkInvalidate();
  const [view, setView] = useState<'all' | 'today' | 'overdue' | 'week'>('all');
  const [project, setProject] = useState('');
  const q = useQuery({ queryKey: ['work-board', view, project], queryFn: () => get<{ today: string; tasks: WorkTask[] }>('/work/tasks/board', { view, project: project || undefined }) });
  const [edit, setEdit] = useState<WorkTask | null>(null);
  const [open, setOpen] = useState(false);
  const [newIn, setNewIn] = useState<TaskStatus>('todo');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const move = useMutation({
    mutationFn: ({ id, status, blockedReason }: { id: string; status: TaskStatus; blockedReason?: string }) => api.patch(`/work/tasks/${id}`, { status, ...(blockedReason ? { blockedReason } : {}) }),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiError(e)),
  });
  const moveTo = (t: WorkTask, status: TaskStatus) => {
    if (t.status === status) return;
    if (status === 'blocked') {
      const reason = window.prompt(`What's blocking “${t.title}”?`, t.blockedReason || '');
      if (!reason?.trim()) return;
      move.mutate({ id: t._id, status, blockedReason: reason.trim() });
    } else move.mutate({ id: t._id, status });
  };

  const tasks = q.data?.tasks ?? [];
  const today = q.data?.today ?? '';
  const card = (t: WorkTask) => {
    const pn = projectNameOf(t.project, projects.data?.items);
    const doneItems = t.checklist.filter((c) => c.done).length;
    return (
      <li key={t._id} draggable onDragStart={() => setDrag(t._id)} onDragEnd={() => { setDrag(null); setOver(null); }}
        className={cn('panel rounded-xl p-3 cursor-grab active:cursor-grabbing', drag === t._id && 'opacity-50')}>
        <button className="w-full text-left" onClick={() => { setEdit(t); setOpen(true); }}>
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 text-muted/60 shrink-0 mt-0.5 hidden md:block" aria-hidden />
            <p className={cn('text-sm font-medium flex-1', t.status === 'done' && 'line-through text-muted')}>{t.title}</p>
          </div>
          {pn && <p className="text-xs text-muted mt-1 truncate">{pn}</p>}
          {t.status === 'blocked' && t.blockedReason && <p className="text-xs text-danger mt-1">⛔ {t.blockedReason}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {t.priority !== 'medium' && <PriorityChip p={t.priority} />}
            <DueChip due={t.dueDate} today={today} done={t.status === 'done'} />
            {t.checklist.length > 0 && <span className="text-xs text-muted inline-flex items-center gap-1"><CheckSquare className="h-3 w-3" />{doneItems}/{t.checklist.length}</span>}
            {t.assignee && t.assignee !== 'me' && <span className="text-xs text-muted">→ {t.assignee}</span>}
          </div>
        </button>
        {/* phones: no drag & drop, so show status buttons */}
        <div className="flex gap-1 mt-2 md:hidden">
          {COLS.filter((c) => c !== t.status).map((c) => <button key={c} onClick={() => moveTo(t, c)} className="text-[11px] px-2 h-6 rounded-md bg-sunken text-muted">{TASK_STATUS[c]}</button>)}
        </div>
      </li>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented label="Show" value={view} onChange={setView} options={[{ v: 'all', label: 'All' }, { v: 'today', label: 'Today' }, { v: 'overdue', label: 'Overdue' }, { v: 'week', label: 'This week' }]} />
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-48" aria-label="Project">{projectOptions(projects.data?.items, 'All projects').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        <Button className="ml-auto" onClick={() => { setEdit(null); setNewIn('todo'); setOpen(true); }}><Plus className="h-4 w-4" />New task</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-80" /> : !tasks.length && view === 'all' && !project ? (
        <EmptyState icon={<CheckSquare className="h-6 w-6" />} title="No tasks yet" body="Add tasks here, or turn a requirement or meeting action item into one." action={<Button onClick={() => { setEdit(null); setOpen(true); }}>Add your first task</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLS.map((col) => {
            const list = tasks.filter((t) => t.status === col);
            return (
              <section key={col} onDragOver={(e) => { e.preventDefault(); setOver(col); }} onDragLeave={() => setOver(null)}
                onDrop={() => { const t = tasks.find((x) => x._id === drag); if (t) moveTo(t, col); setDrag(null); setOver(null); }}
                className={cn('rounded-2xl bg-sunken/60 p-3 min-h-[120px] border-2 border-transparent transition-colors', over === col && 'border-leaf/50 bg-leaf-soft/40')}>
                <div className="flex items-center gap-2 px-1 mb-3">
                  <span className={cn('h-2 w-2 rounded-full', COL_TONE[col])} />
                  <h3 className="text-sm font-semibold">{TASK_STATUS[col]}</h3>
                  <span className="text-xs text-muted num">{list.length}</span>
                  {col !== 'done' && <button className="ml-auto text-muted hover:text-ink" aria-label={`Add task to ${TASK_STATUS[col]}`} onClick={() => { setEdit(null); setNewIn(col); setOpen(true); }}><Plus className="h-4 w-4" /></button>}
                </div>
                <ul className="space-y-2">{list.map(card)}</ul>
                {!list.length && <p className="text-xs text-muted px-1">{col === 'done' ? 'Finished tasks stay here for 7 days.' : 'Nothing here.'}</p>}
              </section>
            );
          })}
        </div>
      )}
      <TaskDialog open={open} onOpenChange={setOpen} task={edit} defaults={{ status: newIn, project }} />
    </div>
  );
}
