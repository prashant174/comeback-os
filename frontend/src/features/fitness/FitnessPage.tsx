import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Camera, Check, Dumbbell, ExternalLink, Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { get, put } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, PageTabs, Panel, Stat, TabPanel, axisTick, chartTooltip } from '@/components/ui/kit';
import { AuthedImage } from '@/components/AuthedImage';
import { RestTimer } from './RestTimer';
import { compressImage } from '@/lib/image';
import { DAY_SHORT, addDays, prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Exercise, Measurement, PlanItem, ProgressPhoto, WorkoutLog, WorkoutPlan } from '@/types';

const FOCUS_TONE = { strength: 'leaf', recovery: 'water', conditioning: 'amber', rest: 'neutral' } as const;
const itemLabel = (i: PlanItem) => `${i.sets} × ${i.durationSec ? `${i.durationSec >= 60 ? `${Math.round(i.durationSec / 60)} min` : `${i.durationSec}s`}` : `${i.reps}`}`;

/* ---------------- Logger ---------------- */
type LogDraft = { title: string; durationMin: number; notes: string; entries: { exercise: string | null; name: string; isTime: boolean; sets: { reps: number; durationSec: number }[] }[] };

function WorkoutLogger({ open, onOpenChange, plan, date }: { open: boolean; onOpenChange: (o: boolean) => void; plan: WorkoutPlan | null; date: string }) {
  const qc = useQueryClient();
  const initial = useMemo<LogDraft>(() => ({
    title: plan?.title ?? 'Workout', durationMin: 30, notes: '',
    entries: (plan?.items ?? []).map((i) => ({ exercise: i.exercise, name: i.name, isTime: i.durationSec > 0, sets: Array.from({ length: Math.max(1, i.sets) }, () => ({ reps: i.reps, durationSec: i.durationSec })) })),
  }), [plan]);
  const [draft, setDraft] = useState<LogDraft>(initial);
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) { setLastOpen(open); if (open) setDraft(initial); }

  const save = useMutation({
    mutationFn: () => api.post('/fitness/logs', { date, title: draft.title, durationMin: Number(draft.durationMin) || 0, notes: draft.notes, completed: true,
      entries: draft.entries.map((e) => ({ exercise: e.exercise, name: e.name, sets: e.sets.map((s) => ({ reps: e.isTime ? 0 : Number(s.reps) || 0, durationSec: e.isTime ? Number(s.durationSec) || 0 : 0 })) })) }),
    onSuccess: () => { ['fitness-today', '/fitness/logs', 'fitness-records', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.success('Workout logged'); onOpenChange(false); },
    onError: (e) => toast.error(apiError(e)),
  });
  const setSet = (ei: number, si: number, key: 'reps' | 'durationSec', v: string) =>
    setDraft((d) => ({ ...d, entries: d.entries.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j !== si ? s : { ...s, [key]: Number(v) }) }) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Log: ${draft.title}`} description="Adjust what you actually did, then save." className="sm:w-[min(96vw,620px)]">
      <div className="space-y-4">
        <div className="panel p-3"><RestTimer seconds={plan?.items[0]?.restSec || 60} /></div>
        {draft.entries.length === 0 && <p className="text-sm text-muted">No exercises in this plan. Add a note and duration, or edit the plan first.</p>}
        {draft.entries.map((e, ei) => (
          <div key={ei}>
            <p className="text-sm font-medium mb-1.5">{e.name}<span className="text-muted font-normal"> · {e.isTime ? 'seconds' : 'reps'} per set</span></p>
            <div className="flex flex-wrap gap-2 items-center">
              {e.sets.map((s, si) => (
                <Input key={si} type="number" min={0} className="w-20" aria-label={`${e.name} set ${si + 1}`}
                  value={e.isTime ? s.durationSec : s.reps} onChange={(ev) => setSet(ei, si, e.isTime ? 'durationSec' : 'reps', ev.target.value)} />
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, entries: d.entries.map((x, i) => i !== ei ? x : { ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1] }] }) }))}><Plus className="h-3.5 w-3.5" />Set</Button>
              {e.sets.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, entries: d.entries.map((x, i) => i !== ei ? x : { ...x, sets: x.sets.slice(0, -1) }) }))}>−</Button>}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div><label className="field-label" htmlFor="wl-dur">Minutes</label><Input id="wl-dur" type="number" min={0} className="mt-1.5" value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })} /></div>
          <div><label className="field-label" htmlFor="wl-notes">Notes</label><Input id="wl-notes" className="mt-1.5" value={draft.notes} placeholder="Felt strong, knee okay…" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save workout</Button></div>
      </div>
    </Dialog>
  );
}

/* ---------------- Today ---------------- */
function TodayTab() {
  const date = useToday();
  const q = useQuery({ queryKey: ['fitness-today'], queryFn: () => get<{ plan: WorkoutPlan | null; logs: WorkoutLog[]; done: boolean }>('/fitness/today') });
  const logs = useList<WorkoutLog>('/fitness/logs', { limit: 10 });
  const ex = useList<Exercise>('/fitness/exercises', { limit: 200 });
  const m = useResourceMutations<WorkoutLog>('/fitness/logs', { noun: 'Workout', invalidate: [['fitness-today'], ['fitness-records']] });
  const [open, setOpen] = useState(false);
  const plan = q.data?.plan ?? null;
  const byName = new Map(ex.data?.items.map((e) => [e.name, e]));
  if (q.isLoading) return <Skeleton className="h-72" />;
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <section className="panel p-5 sm:p-6 rounded-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{DAY_SHORT[new Date(date + 'T00:00:00').getDay()]} · today’s plan</p>
            <h2 className="text-2xl font-semibold mt-0.5">{plan?.title ?? 'No plan'}</h2>
            {plan && <Chip tone={FOCUS_TONE[plan.focus]} className="mt-2">{plan.focus}</Chip>}
          </div>
          {q.data?.done ? <Chip tone="leaf" className="h-8 px-3 text-sm"><Check className="h-4 w-4" />Logged today</Chip>
            : <Button size="lg" onClick={() => setOpen(true)} disabled={!plan || plan.focus === 'rest'}><Dumbbell className="h-4 w-4" />Start workout</Button>}
        </div>
        {plan?.focus === 'rest' || !plan?.items.length ? (
          <p className="text-sm text-muted mt-6">Rest day. Recovery is part of the plan — a short walk is a bonus, not a requirement.</p>
        ) : (
          <ol className="mt-6 divide-y divide-line">
            {plan.items.map((i, idx) => {
              const e = byName.get(i.name);
              return (
                <li key={idx} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{i.name}</p>
                    <span className="text-sm num text-muted">{itemLabel(i)}{i.restSec ? ` · rest ${i.restSec}s` : ''}</span>
                  </div>
                  {e?.instructions && <p className="text-sm text-muted mt-1 max-w-prose">{e.instructions}</p>}
                  {e?.videoUrl && <a href={e.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-leaf inline-flex items-center gap-1 mt-1 hover:underline">Watch demo <ExternalLink className="h-3 w-3" /></a>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <Panel title="Recent workouts" action={<Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!plan}>Log</Button>}>
        {!logs.data?.items.length ? <p className="text-sm text-muted">No workouts logged yet.</p> : (
          <ul className="divide-y divide-line -mx-5">
            {logs.data.items.map((l) => (
              <li key={l._id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{l.title}</p><p className="text-xs text-muted">{prettyDate(l.date, { day: 'numeric', month: 'short' })} · {l.durationMin} min · {l.entries.length} exercises</p></div>
                <Button variant="ghost" size="icon" aria-label="Delete workout" onClick={() => m.remove.mutate(l._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <WorkoutLogger open={open} onOpenChange={setOpen} plan={plan} date={date} />
    </div>
  );
}

/* ---------------- Plan editor ---------------- */
function PlanTab() {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['fitness-plans'], queryFn: () => get<WorkoutPlan[]>('/fitness/plans') });
  const ex = useList<Exercise>('/fitness/exercises', { limit: 200 });
  const [edit, setEdit] = useState<WorkoutPlan | null>(null);
  const [draft, setDraft] = useState<Pick<WorkoutPlan, 'title' | 'focus' | 'items'> | null>(null);
  const save = useMutation({
    mutationFn: () => put(`/fitness/plans/${edit!.dayOfWeek}`, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fitness-plans'] }); qc.invalidateQueries({ queryKey: ['fitness-today'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Plan saved'); setEdit(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const order = [1, 2, 3, 4, 5, 6, 0];
  const upd = (i: number, patch: Partial<PlanItem>) => setDraft((d) => d && ({ ...d, items: d.items.map((x, j) => j === i ? { ...x, ...patch } : x) }));
  if (plans.isLoading) return <Skeleton className="h-60" />;
  return (
    <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {order.map((dow) => {
          const p = plans.data?.find((x) => x.dayOfWeek === dow);
          return (
            <section key={dow} className="panel p-4">
              <div className="flex items-start justify-between">
                <div><p className="text-xs text-muted">{DAY_SHORT[dow]}</p><h3 className="font-semibold">{p?.title ?? '—'}</h3></div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${DAY_SHORT[dow]} plan`} onClick={() => { const base = p ?? { _id: '', dayOfWeek: dow, title: 'Workout', focus: 'strength' as const, items: [] }; setEdit(base); setDraft({ title: base.title, focus: base.focus, items: base.items.map((x) => ({ ...x })) }); }}><Pencil className="h-4 w-4" /></Button>
              </div>
              {p && <Chip tone={FOCUS_TONE[p.focus]} className="mt-1">{p.focus}</Chip>}
              <ul className="mt-3 space-y-1">{p?.items.map((i, k) => <li key={k} className="text-sm flex justify-between gap-2"><span className="truncate">{i.name}</span><span className="text-muted text-xs num shrink-0">{itemLabel(i)}</span></li>)}</ul>
            </section>
          );
        })}
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`${edit ? DAY_SHORT[edit.dayOfWeek] : ''} workout`} className="sm:w-[min(96vw,720px)]">
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="field-label" htmlFor="pl-title">Title</label><Input id="pl-title" className="mt-1.5" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div><label className="field-label" htmlFor="pl-focus">Focus</label>
                <Select id="pl-focus" className="mt-1.5" value={draft.focus} onChange={(e) => setDraft({ ...draft, focus: e.target.value as WorkoutPlan['focus'] })}>
                  <option value="strength">Strength</option><option value="recovery">Recovery</option><option value="conditioning">Conditioning</option><option value="rest">Rest</option>
                </Select></div>
            </div>
            <div className="hidden sm:grid grid-cols-[1fr_64px_72px_80px_72px_36px] gap-2 text-xs text-muted"><span>Exercise</span><span>Sets</span><span>Reps</span><span>Seconds</span><span>Rest s</span><span /></div>
            {draft.items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_72px] sm:grid-cols-[1fr_64px_72px_80px_72px_36px] gap-2">
                <Select aria-label="Exercise" value={it.exercise ?? ''} onChange={(e) => { const x = ex.data?.items.find((y) => y._id === e.target.value); upd(i, { exercise: x?._id ?? null, name: x?.name ?? it.name }); }}>
                  {!it.exercise && <option value="">{it.name}</option>}
                  {ex.data?.items.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </Select>
                <Input type="number" min={0} aria-label="Sets" value={it.sets} onChange={(e) => upd(i, { sets: Number(e.target.value) })} />
                <Input type="number" min={0} aria-label="Reps" value={it.reps} onChange={(e) => upd(i, { reps: Number(e.target.value) })} />
                <Input type="number" min={0} aria-label="Seconds" value={it.durationSec} onChange={(e) => upd(i, { durationSec: Number(e.target.value) })} />
                <Input type="number" min={0} aria-label="Rest seconds" value={it.restSec} onChange={(e) => upd(i, { restSec: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" disabled={!ex.data?.items.length} onClick={() => { const x = ex.data!.items[0]; setDraft({ ...draft, items: [...draft.items, { exercise: x._id, name: x.name, sets: 3, reps: x.type === 'reps' ? 10 : 0, durationSec: x.type === 'time' ? 30 : 0, restSec: 60 }] }); }}><Plus className="h-4 w-4" />Add exercise</Button>
            <p className="text-xs text-muted">Use reps for rep-based moves and seconds for timed ones (plank, walking). Leave the other at 0.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save plan</Button></div>
          </div>
        )}
      </Dialog>
    </>
  );
}

/* ---------------- Library ---------------- */
const EX_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
  { name: 'muscleGroup', label: 'Muscle group', type: 'text', placeholder: 'chest, legs, core…' },
  { name: 'type', label: 'Measured in', type: 'select', options: [{ value: 'reps', label: 'Reps' }, { value: 'time', label: 'Time' }] },
  { name: 'difficulty', label: 'Difficulty', type: 'select', options: ['beginner', 'intermediate', 'advanced'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'videoUrl', label: 'Video / image link', type: 'url', placeholder: 'https://…', full: true },
  { name: 'instructions', label: 'Instructions', type: 'textarea', max: 1500 },
];
function LibraryTab() {
  const [q, setQ] = useState('');
  const list = useList<Exercise>('/fitness/exercises', { limit: 200, q: q || undefined });
  const m = useResourceMutations<Exercise>('/fitness/exercises', { noun: 'Exercise' });
  const [edit, setEdit] = useState<Exercise | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Exercise | null>(null);
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search exercises" />
        <Button className="ml-auto" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New exercise</Button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.data?.items.map((e) => (
          <section key={e._id} className="panel p-4">
            <div className="flex justify-between gap-2">
              <div><h3 className="font-medium">{e.name}</h3><div className="flex gap-1.5 mt-1.5"><Chip>{e.muscleGroup}</Chip><Chip>{e.type}</Chip><Chip>{e.difficulty}</Chip></div></div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon" aria-label={`Edit ${e.name}`} onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Delete ${e.name}`} onClick={() => setDel(e)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {e.instructions && <p className="text-sm text-muted mt-3 line-clamp-4">{e.instructions}</p>}
            {e.videoUrl && <a href={e.videoUrl} target="_blank" rel="noreferrer" className="text-xs text-leaf inline-flex items-center gap-1 mt-2 hover:underline">Open demo <ExternalLink className="h-3 w-3" /></a>}
          </section>
        ))}
      </div>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit exercise' : 'New exercise'} fields={EX_FIELDS} initial={edit ?? undefined} submitLabel={edit ? 'Save exercise' : 'Add exercise'}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit._id, body: v }) : m.create.mutateAsync(v)} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name}”?`} description="Plans keep the exercise name; it just won't link to instructions any more."
        confirmLabel="Delete exercise" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}

/* ---------------- Progress ---------------- */
const MEASURE_FIELDS: FieldDef[] = [
  { name: 'date', label: 'Date', type: 'date', required: true },
  { name: 'weightKg', label: 'Weight (kg)', type: 'number', step: '0.1', min: 20, max: 400 },
  { name: 'waistCm', label: 'Waist (cm)', type: 'number', step: '0.1', min: 0, max: 300 },
  { name: 'chestCm', label: 'Chest (cm)', type: 'number', step: '0.1', min: 0, max: 300 },
  { name: 'armCm', label: 'Arm (cm)', type: 'number', step: '0.1', min: 0, max: 100 },
  { name: 'thighCm', label: 'Thigh (cm)', type: 'number', step: '0.1', min: 0, max: 150 },
  { name: 'notes', label: 'Notes', type: 'text', full: true },
];
function ProgressTab() {
  const today = useToday();
  const qc = useQueryClient();
  const meas = useList<Measurement>('/fitness/measurements', { limit: 200 });
  const mm = useResourceMutations<Measurement>('/fitness/measurements', { noun: 'Measurement', invalidate: [['settings']] });
  const records = useQuery({ queryKey: ['fitness-records'], queryFn: () => get<{ name: string; bestReps: number; bestSec: number; date: string; sessions: number }[]>('/fitness/records') });
  const logs = useList<WorkoutLog>('/fitness/logs', { from: addDays(today, -55), limit: 200 });
  const [exName, setExName] = useState('');
  const hist = useQuery({ queryKey: ['fitness-history', exName], queryFn: () => get<{ date: string; bestSet: number; totalReps: number; totalSec: number }[]>('/fitness/history', { name: exName }), enabled: !!exName });
  const photos = useQuery({ queryKey: ['fitness-photos'], queryFn: () => get<ProgressPhoto[]>('/fitness/photos') });
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const weights = [...(meas.data?.items ?? [])].filter((x) => x.weightKg).sort((a, b) => a.date.localeCompare(b.date));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = addDays(today, -7 * (7 - i)), start = addDays(end, -6);
    return { week: prettyDate(start, { day: 'numeric', month: 'short' }), workouts: logs.data?.items.filter((l) => l.date >= start && l.date <= end && l.completed).length ?? 0 };
  });

  const upload = async (file: File) => {
    const fd = new FormData(); fd.append('photo', await compressImage(file)); fd.append('date', today);
    setUploading(true);
    try { await api.post('/fitness/photos', fd); qc.invalidateQueries({ queryKey: ['fitness-photos'] }); toast.success('Photo added'); }
    catch (e) { toast.error(apiError(e)); } finally { setUploading(false); }
  };
  const delPhoto = useMutation({ mutationFn: (id: string) => api.delete(`/fitness/photos/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['fitness-photos'] }) });

  const latest = weights.at(-1), first = weights[0];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Current weight" value={latest ? `${latest.weightKg} kg` : '—'} sub={latest ? prettyDate(latest.date, { day: 'numeric', month: 'short' }) : 'Log your first weigh-in'} />
        <Stat label="Change" value={latest && first && latest !== first ? `${(latest.weightKg! - first.weightKg! > 0 ? '+' : '')}${(latest.weightKg! - first.weightKg!).toFixed(1)} kg` : '—'} sub="since first entry" />
        <Stat label="Workouts (8 weeks)" value={weeks.reduce((s, w) => s + w.workouts, 0)} />
        <Stat label="Personal records" value={records.data?.length ?? 0} sub="exercises tracked" />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Weight" action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Log measurement</Button>}>
          {weights.length < 2 ? <p className="text-sm text-muted py-10 text-center">Log at least two weigh-ins to see a trend.</p> : (
            <div className="h-56 -ml-2"><ResponsiveContainer><LineChart data={weights}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
              <XAxis dataKey="date" tickFormatter={(d) => prettyDate(d, { day: 'numeric', month: 'short' })} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis domain={[(m: number) => Math.floor(m - 1), (m: number) => Math.ceil(m + 1)]} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...chartTooltip} formatter={(v: number) => [`${v} kg`, 'Weight']} />
              <Line dataKey="weightKg" stroke="hsl(var(--leaf))" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          )}
        </Panel>
        <Panel title="Workout consistency">
          <div className="h-56 -ml-2"><ResponsiveContainer><BarChart data={weeks}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
            <XAxis dataKey="week" tick={axisTick} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...chartTooltip} formatter={(v: number) => [v, 'Workouts']} /><Bar dataKey="workouts" fill="hsl(var(--leaf))" radius={[6, 6, 2, 2]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Panel title="Personal records">
          {!records.data?.length ? <p className="text-sm text-muted">Records appear after you log workouts.</p> : (
            <table className="w-full text-sm"><thead><tr className="text-xs text-muted text-left"><th className="font-normal pb-2">Exercise</th><th className="font-normal pb-2 text-right">Best set</th><th className="font-normal pb-2 text-right">Sessions</th></tr></thead>
              <tbody className="divide-y divide-line">{records.data.map((r) => (
                <tr key={r.name}><td className="py-2"><button className="hover:text-leaf text-left" onClick={() => setExName(r.name)}>{r.name}</button></td>
                  <td className="py-2 text-right num"><Trophy className="inline h-3.5 w-3.5 text-amber mr-1" />{r.bestSec ? `${r.bestSec}s` : `${r.bestReps} reps`}</td><td className="py-2 text-right num text-muted">{r.sessions}</td></tr>
              ))}</tbody></table>
          )}
        </Panel>
        <Panel title="Strength progression" action={
          <Select value={exName} onChange={(e) => setExName(e.target.value)} className="w-48 h-8" aria-label="Exercise">
            <option value="">Choose exercise</option>{records.data?.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
          </Select>}>
          {!exName ? <p className="text-sm text-muted py-10 text-center">Pick an exercise to see its best set over time.</p> : (
            <div className="h-52 -ml-2"><ResponsiveContainer><LineChart data={hist.data ?? []}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
              <XAxis dataKey="date" tickFormatter={(d) => prettyDate(d, { day: 'numeric', month: 'short' })} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} /><Tooltip {...chartTooltip} formatter={(v: number) => [v, 'Best set']} />
              <Line dataKey="bestSet" stroke="hsl(var(--amber))" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
          )}
        </Panel>
      </div>
      <Panel title="Measurements">
        {!meas.data?.items.length ? <p className="text-sm text-muted">No measurements yet.</p> : (
          <div className="overflow-x-auto -mx-5"><table className="w-full text-sm min-w-[560px]"><thead><tr className="text-xs text-muted text-left">{['Date', 'Weight', 'Waist', 'Chest', 'Arm', 'Thigh', ''].map((h) => <th key={h} className="font-normal px-5 pb-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{meas.data.items.map((x) => (
              <tr key={x._id}><td className="px-5 py-2">{prettyDate(x.date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                {[x.weightKg && `${x.weightKg} kg`, x.waistCm, x.chestCm, x.armCm, x.thighCm].map((v, i) => <td key={i} className="px-5 py-2 num">{v ?? '—'}</td>)}
                <td className="px-5 py-2 text-right"><Button variant="ghost" size="icon" aria-label="Delete measurement" onClick={() => mm.remove.mutate(x._id)}><Trash2 className="h-4 w-4 text-muted" /></Button></td></tr>
            ))}</tbody></table></div>
        )}
      </Panel>
      <Panel title="Progress photos" action={
        <label className={cn('inline-flex items-center gap-2 h-8 px-3 text-sm rounded-lg border border-line cursor-pointer hover:bg-sunken', uploading && 'opacity-50 pointer-events-none')}>
          <Camera className="h-4 w-4" />{uploading ? 'Uploading…' : 'Add photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>}>
        {!photos.data?.length ? <p className="text-sm text-muted">Private to you. Same spot, same light, every 2–4 weeks works best.</p> : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {photos.data.map((p) => (
              <figure key={p._id} className="relative group">
                <AuthedImage src={`/api/fitness/photos/${p._id}/file`} alt={`Progress photo ${p.date}`} className="aspect-[3/4] w-full object-cover rounded-xl" />
                <figcaption className="text-xs text-muted mt-1">{prettyDate(p.date, { day: 'numeric', month: 'short' })}</figcaption>
                <button onClick={() => delPhoto.mutate(p._id)} aria-label="Delete photo" className="absolute top-1.5 right-1.5 h-7 w-7 rounded-lg bg-black/50 text-white grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
              </figure>
            ))}
          </div>
        )}
      </Panel>
      <FormDialog open={open} onOpenChange={setOpen} title="Log measurement" fields={MEASURE_FIELDS} initial={{ date: today, weightKg: latest?.weightKg ?? '' }} submitLabel="Save measurement"
        onSubmit={(v) => mm.create.mutateAsync(v)} />
    </div>
  );
}

export default function FitnessPage() {
  const [tab, setTab] = useState('today');
  return (
    <div>
      <PageHeader title="Fitness" subtitle="Home workouts, no equipment needed." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'today', label: 'Today' }, { v: 'plan', label: 'Weekly plan' }, { v: 'library', label: 'Exercise library' }, { v: 'progress', label: 'Progress' }]}>
        <TabPanel value="today"><TodayTab /></TabPanel>
        <TabPanel value="plan"><PlanTab /></TabPanel>
        <TabPanel value="library"><LibraryTab /></TabPanel>
        <TabPanel value="progress"><ProgressTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
