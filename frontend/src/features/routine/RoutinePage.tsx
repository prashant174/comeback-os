import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarClock, CalendarOff, Check, GripVertical, Pencil, Plus, SkipForward, Trash2, Undo2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { LeaveDialog, DAY_TYPE_LABEL } from './LeaveDialog';
import { addDays, prettyDate } from '@/lib/date';
import { get, put } from '@/lib/resource';
import { apiError } from '@/lib/api';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, PageHeader, Skeleton, Switch } from '@/components/ui/misc';
import { Chip, DateNav, PageTabs, Panel, Progress, TabPanel, dateTitle } from '@/components/ui/kit';
import { DAY_LETTER, DAY_SHORT, to12h, toMinutes } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Routine, RoutineDay } from '@/types';

const PRI_TONE = { high: 'danger', medium: 'amber', low: 'neutral' } as const;

/* ---------------- Today ---------------- */
function TodayTab() {
  const today = useToday();
  const [date, setDate] = useState(today);
  useEffect(() => setDate(today), [today]);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['routine-day', date], queryFn: () => get<RoutineDay>('/routines/day', { date }) });
  const [note, setNote] = useState('');
  useEffect(() => setNote(q.data?.note ?? ''), [q.data?.note]);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string | null }) => put(`/routines/day/${date}/status`, { activityId: id, status }),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['routine-day', date] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const saveNote = useMutation({ mutationFn: () => put(`/routines/day/${date}/note`, { note }), onSuccess: () => toast.success('Note saved'), onError: (e) => toast.error(apiError(e)) });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const undoLeave = useMutation({
    mutationFn: (group: boolean) => api.delete(`/routines/overrides/${date}`, { params: { group } }),
    onSuccess: () => { ['routine-day', 'routine-overrides', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success('Back to the normal routine'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const d = q.data;
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
      {d?.override && (
        <div className="lg:col-span-2 panel border-amber/40 bg-amber/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <CalendarOff className="h-5 w-5 text-amber shrink-0" />
          <p className="text-sm flex-1 min-w-[200px]"><b>{DAY_TYPE_LABEL[d.override.type] ?? 'Leave'}</b> {date === today ? 'today' : 'on this day'}{d.override.note ? ` — ${d.override.note}` : ''}. {d.routine ? <>Following <b>{d.routine.name}</b> instead of the usual routine.</> : 'No routine planned.'}</p>
          <Button size="sm" variant="outline" onClick={() => undoLeave.mutate(false)} loading={undoLeave.isPending}><Undo2 className="h-4 w-4" />Undo this day</Button>
        </div>
      )}
      <Panel title={d?.routine ? `${dateTitle(date, today)} · ${d.routine.name}` : dateTitle(date, today)} action={
        <div className="flex flex-wrap items-center gap-2">
          {!d?.override && <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)}><CalendarOff className="h-4 w-4" />Mark leave</Button>}
          <DateNav date={date} onChange={setDate} max={addDays(today, 60)} />
        </div>}>
        {q.isLoading ? <Skeleton className="h-64" /> : !d?.routine ? (
          d?.override ? <EmptyState icon={<CalendarOff className="h-6 w-6" />} title="Free day" body="Nothing scheduled. Enjoy the break — habits and water still count." />
          : <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="No routine for this day" body="Create a routine and assign it to this weekday in the Routines tab." />
        ) : (
          <ol className="divide-y divide-line -mx-5">
            {d.activities.map((a) => (
              <li key={a._id} className={cn('flex items-center gap-3 px-5 py-3', a.isNow && 'bg-leaf-soft/50')}>
                <div className="w-[88px] shrink-0 text-xs text-muted num leading-tight">{to12h(a.start)}<br />{to12h(a.end)}</div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium truncate', a.status === 'done' && 'line-through text-muted')}>{a.title}</p>
                  <div className="flex gap-1.5 mt-1">
                    <Chip tone={PRI_TONE[a.priority]}>{a.priority}</Chip>
                    {a.isNow && <Chip tone="leaf">now</Chip>}
                    {a.status === 'missed' && !a.explicit && <Chip tone="danger">missed</Chip>}
                    {a.status === 'skipped' && <Chip>skipped</Chip>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant={a.status === 'done' ? 'primary' : 'outline'} aria-label={`Mark ${a.title} done`} aria-pressed={a.status === 'done'}
                    onClick={() => setStatus.mutate({ id: a._id, status: a.status === 'done' ? null : 'done' })}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Skip ${a.title}`} title="Skip"
                    onClick={() => setStatus.mutate({ id: a._id, status: a.status === 'skipped' ? null : 'skipped' })}><SkipForward className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
      <div className="space-y-5">
        {d?.routine && (
          <Panel title="Progress">
            <p className="font-display text-3xl font-semibold num">{d.stats.done}<span className="text-muted text-lg">/{d.stats.total}</span></p>
            <Progress value={d.stats.done} max={d.stats.total} className="mt-3" label="Routine progress" />
            <p className="text-xs text-muted mt-2">{d.stats.missed} missed so far. Past activities you didn't mark count as missed.</p>
          </Panel>
        )}
        <Panel title="Daily note">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} maxLength={2000} placeholder="How did the day go? What got in the way?"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-leaf" aria-label="Daily note" />
          <Button size="sm" className="mt-2" loading={saveNote.isPending} onClick={() => saveNote.mutate()} disabled={note === (d?.note ?? '')}>Save note</Button>
        </Panel>
      </div>
      <LeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} date={date} />
    </div>
  );
}

/* ---------------- Upcoming leaves ---------------- */
type OverrideRow = { _id: string; date: string; type: string; note: string; groupId: string | null; routine: { name: string } | null };
function UpcomingLeaves() {
  const today = useToday();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['routine-overrides'], queryFn: () => get<OverrideRow[]>('/routines/overrides', { from: today }) });
  const del = useMutation({
    mutationFn: (date: string) => api.delete(`/routines/overrides/${date}`, { params: { group: true } }),
    onSuccess: () => ['routine-day', 'routine-overrides', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
    onError: (e) => toast.error(apiError(e)),
  });
  const [open, setOpen] = useState(false);
  const groups = Object.values((q.data ?? []).reduce<Record<string, OverrideRow[]>>((a, o) => { (a[o.groupId ?? o._id] ??= []).push(o); return a; }, {}));
  return (
    <Panel title="Leaves & holidays" className="mt-5" action={<Button size="sm" variant="outline" onClick={() => setOpen(true)}><CalendarOff className="h-4 w-4" />Mark leave</Button>}>
      {!groups.length ? <p className="text-sm text-muted">No upcoming leaves. On a leave day the “Leave day” routine replaces your weekday one.</p> : (
        <ul className="divide-y divide-line -mx-5">
          {groups.map((g) => (
            <li key={g[0]._id} className="flex items-center gap-3 px-5 py-2.5">
              <Chip tone="amber">{DAY_TYPE_LABEL[g[0].type]}</Chip>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{prettyDate(g[0].date, { weekday: 'short', day: 'numeric', month: 'short' })}{g.length > 1 ? ` → ${prettyDate(g[g.length - 1].date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${g.length} days` : ''}</p>
                <p className="text-xs text-muted truncate">{g[0].routine?.name ?? 'Free day'}{g[0].note ? ` · ${g[0].note}` : ''}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove leave" onClick={() => del.mutate(g[0].date)}><Trash2 className="h-4 w-4 text-muted" /></Button>
            </li>
          ))}
        </ul>
      )}
      <LeaveDialog open={open} onOpenChange={setOpen} date={today} />
    </Panel>
  );
}

/* ---------------- Editor ---------------- */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(60),
  days: z.array(z.number()), // empty = on-demand (used for leave days)
  isActive: z.boolean(),
  activities: z.array(z.object({
    _id: z.string().optional(), title: z.string().trim().min(1, 'Required').max(80), start: hhmm, end: hhmm,
    priority: z.enum(['low', 'medium', 'high']), category: z.string().max(30), notes: z.string().max(300),
  }).refine((a) => a.start < a.end, { message: 'End after start', path: ['end'] })),
});
type FormV = z.infer<typeof schema>;

function RoutineEditor({ open, onOpenChange, routine }: { open: boolean; onOpenChange: (o: boolean) => void; routine: Routine | null }) {
  const m = useResourceMutations<Routine>('/routines', { noun: 'Routine', invalidate: [['routine-day'], ['routine-week']] });
  const { register, control, handleSubmit, reset, getValues, setValue, formState: { errors, isSubmitting } } = useForm<FormV>({ resolver: zodResolver(schema) });
  const { fields, append, remove } = useFieldArray({ control, name: 'activities' });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) reset(routine
      ? { name: routine.name, days: routine.days, isActive: routine.isActive, activities: routine.activities.map((a) => ({ ...a })) }
      : { name: '', days: [1, 2, 3, 4, 5], isActive: true, activities: [{ title: '', start: '07:00', end: '07:30', priority: 'medium', category: 'other', notes: '' }] });
  }, [open, routine, reset]);

  /** Drag-and-drop scheduling: dropping one activity on another swaps their time slots. */
  const swapSlots = (from: number, to: number) => {
    if (from === to) return;
    const acts = getValues('activities');
    const a = acts[from], b = acts[to];
    setValue(`activities.${from}.start`, b.start); setValue(`activities.${from}.end`, b.end);
    setValue(`activities.${to}.start`, a.start); setValue(`activities.${to}.end`, a.end);
    toast.message(`Swapped “${a.title || 'activity'}” and “${b.title || 'activity'}”`);
  };

  const submit = handleSubmit(async (v) => {
    if (routine) await m.update.mutateAsync({ id: routine._id, body: v }); else await m.create.mutateAsync(v);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={routine ? 'Edit routine' : 'New routine'} description="Drag an activity onto another to swap their time slots." className="sm:w-[min(96vw,760px)]">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
          <div>
            <label className="field-label" htmlFor="rt-name">Name</label>
            <Input id="rt-name" className="mt-1.5" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name.message}</p>}
          </div>
          <Controller control={control} name="isActive" render={({ field }) => (
            <label className="flex items-center gap-2 text-sm h-10"><Switch checked={field.value} onCheckedChange={field.onChange} label="Active" />Active</label>
          )} />
        </div>
        <Controller control={control} name="days" render={({ field }) => (
          <fieldset>
            <legend className="field-label mb-1.5">Applies on</legend>
            <div className="flex gap-1.5">
              {DAY_LETTER.map((d, i) => (
                <button type="button" key={i} aria-pressed={field.value?.includes(i)} aria-label={DAY_SHORT[i]}
                  onClick={() => field.onChange(field.value.includes(i) ? field.value.filter((x) => x !== i) : [...field.value, i].sort())}
                  className={cn('h-9 w-9 rounded-lg text-sm font-medium border', field.value?.includes(i) ? 'bg-leaf text-white border-leaf dark:text-[#06140D]' : 'border-line text-muted hover:bg-sunken')}>{d}</button>
              ))}
            </div>
            <p className="hint mt-1">Pick no days for an on-demand routine you only use on leave/holidays.</p>
          </fieldset>
        )} />
        <div>
          <p className="field-label mb-2">Activities</p>
          <ul className="space-y-2">
            {fields.map((f, i) => (
              <li key={f.id} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragIdx !== null) swapSlots(dragIdx, i); setDragIdx(null); }}
                className={cn('grid grid-cols-[20px_1fr_auto] sm:grid-cols-[20px_1fr_104px_104px_110px_auto] gap-2 items-start rounded-xl p-1.5 -mx-1.5', dragIdx === i && 'bg-sunken')}>
                <GripVertical className="h-4 w-4 text-muted mt-3 cursor-grab" aria-hidden />
                <div>
                  <Input placeholder="Activity" aria-label="Activity name" {...register(`activities.${i}.title`)} aria-invalid={!!errors.activities?.[i]?.title} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="sm:order-last mt-0.5" onClick={() => remove(i)} aria-label="Remove activity"><Trash2 className="h-4 w-4" /></Button>
                <Input type="time" aria-label="Start" className="col-start-2 sm:col-start-auto" {...register(`activities.${i}.start`)} />
                <div className="col-start-2 sm:col-start-auto">
                  <Input type="time" aria-label="End" {...register(`activities.${i}.end`)} aria-invalid={!!errors.activities?.[i]?.end} />
                  {errors.activities?.[i]?.end && <p className="text-[11px] text-danger mt-0.5">{errors.activities[i]?.end?.message}</p>}
                </div>
                <Select aria-label="Priority" className="col-start-2 sm:col-start-auto" {...register(`activities.${i}.priority`)}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </Select>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-3"
            onClick={() => { const last = getValues('activities').at(-1); const s = last?.end ?? '07:00'; const e = `${String(Math.min(23, Math.floor((toMinutes(s) + 30) / 60))).padStart(2, '0')}:${String((toMinutes(s) + 30) % 60).padStart(2, '0')}`; append({ title: '', start: s, end: e > s ? e : '23:59', priority: 'medium', category: 'other', notes: '' }); }}>
            <Plus className="h-4 w-4" />Add activity
          </Button>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{routine ? 'Save routine' : 'Create routine'}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RoutinesTab() {
  const q = useList<Routine>('/routines');
  const m = useResourceMutations<Routine>('/routines', { noun: 'Routine', invalidate: [['routine-day'], ['routine-week']] });
  const [edit, setEdit] = useState<Routine | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Routine | null>(null);
  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New routine</Button></div>
      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {q.data?.items.map((r) => (
            <section key={r._id} className={cn('panel p-5', !r.isActive && 'opacity-60')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.days.length === 0 ? <Chip tone="amber" className="mt-2">On demand · leave days</Chip>
                    : <div className="flex gap-1 mt-2">{DAY_LETTER.map((d, i) => <span key={i} className={cn('h-6 w-6 rounded-md text-[11px] grid place-items-center', r.days.includes(i) ? 'bg-leaf-soft text-leaf-ink font-semibold' : 'text-muted/50')}>{d}</span>)}</div>}
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => setDel(r)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
              <ul className="mt-4 space-y-1.5">
                {r.activities.slice(0, 7).map((a) => (
                  <li key={a._id} className="flex justify-between text-sm gap-3"><span className="truncate">{a.title}</span><span className="text-muted text-xs num shrink-0">{to12h(a.start)}</span></li>
                ))}
                {r.activities.length > 7 && <li className="text-xs text-muted">+{r.activities.length - 7} more</li>}
              </ul>
            </section>
          ))}
        </div>
      )}
      <UpcomingLeaves />
      <RoutineEditor open={open} onOpenChange={setOpen} routine={edit} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name}”?`} description="Days it covered will have no routine until you assign another."
        confirmLabel="Delete routine" loading={m.remove.isPending} onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}

/* ---------------- Week calendar ---------------- */
function WeekTab() {
  const q = useQuery({ queryKey: ['routine-week'], queryFn: () => get<{ dayOfWeek: number; routine: Routine | null }[]>('/routines/week') });
  const startH = 5, endH = 24, pxPerMin = 0.8;
  const order = [1, 2, 3, 4, 5, 6, 0];
  if (q.isLoading) return <Skeleton className="h-96" />;
  return (
    <div className="panel overflow-x-auto">
      <div className="min-w-[760px] grid grid-cols-[48px_repeat(7,1fr)]">
        <div />
        {order.map((dow) => <div key={dow} className="text-center text-xs font-medium py-2 border-b border-line">{DAY_SHORT[dow]}<div className="text-[10px] text-muted font-normal truncate px-1">{q.data?.[dow]?.routine?.name ?? '—'}</div></div>)}
        <div className="relative" style={{ height: (endH - startH) * 60 * pxPerMin }}>
          {Array.from({ length: endH - startH }, (_, i) => <span key={i} className="absolute right-2 text-[10px] text-muted num -translate-y-1/2" style={{ top: i * 60 * pxPerMin }}>{to12h(`${String(startH + i).padStart(2, '0')}:00`).replace(':00', '')}</span>)}
        </div>
        {order.map((dow) => (
          <div key={dow} className="relative border-l border-line" style={{ height: (endH - startH) * 60 * pxPerMin }}>
            {Array.from({ length: endH - startH }, (_, i) => <div key={i} className="absolute inset-x-0 border-t border-line/60" style={{ top: i * 60 * pxPerMin }} />)}
            {q.data?.[dow]?.routine?.activities.map((a) => {
              const top = Math.max(0, (toMinutes(a.start) - startH * 60) * pxPerMin);
              const h = Math.max(14, (toMinutes(a.end) - toMinutes(a.start)) * pxPerMin);
              return (
                <div key={a._id} title={`${a.title} · ${to12h(a.start)}–${to12h(a.end)}`}
                  className={cn('absolute inset-x-1 rounded-md px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden border',
                    a.priority === 'high' ? 'bg-leaf-soft border-leaf/40 text-leaf-ink' : 'bg-sunken border-line')} style={{ top, height: h }}>
                  {a.title}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RoutinePage() {
  const [tab, setTab] = useState('today');
  return (
    <div>
      <PageHeader title="Daily routine" subtitle="Plan the day, then mark it off as you go." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'today', label: 'Today' }, { v: 'routines', label: 'Routines' }, { v: 'week', label: 'Week calendar' }]}>
        <TabPanel value="today"><TodayTab /></TabPanel>
        <TabPanel value="routines"><RoutinesTab /></TabPanel>
        <TabPanel value="week"><WeekTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
