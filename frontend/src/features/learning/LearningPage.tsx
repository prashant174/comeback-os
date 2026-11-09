import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Check, ChevronDown, ExternalLink, FolderGit2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { get } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, PageTabs, Panel, Progress, Stars, TabPanel, axisTick, chartTooltip } from '@/components/ui/kit';
import { StudyTimer } from './StudyTimer';
import { fmtMinutes, prettyDate, shortDay } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { LearningPath, Project, StudySession } from '@/types';

type Summary = { todayMinutes: number; weekMinutes: number; targetMinutes: number; weekly: { date: string; minutes: number }[]; roadmap: { totalTopics: number; doneTopics: number; pct: number; day: number | null }; paths: { _id: string; title: string; total: number; done: number; proficiency: number }[] };
const useSummary = () => useQuery({ queryKey: ['learning-summary'], queryFn: () => get<Summary>('/learning/summary') });

/* ---------------- Roadmap ---------------- */
const PATH_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 80, full: true },
  { name: 'description', label: 'Description', type: 'textarea', max: 500 },
  { name: 'startDate', label: 'Start date', type: 'date' },
  { name: 'targetDate', label: 'Target date', type: 'date' },
];

function PathCard({ p }: { p: LearningPath }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [res, setRes] = useState({ title: '', url: '' });
  const [editOpen, setEditOpen] = useState(false);
  const [del, setDel] = useState(false);
  const save = useMutation({
    mutationFn: (body: Partial<LearningPath>) => api.patch(`/learning/paths/${p._id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['/learning/paths'] }); qc.invalidateQueries({ queryKey: ['learning-summary'] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/learning/paths/${p._id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['/learning/paths'] }); qc.invalidateQueries({ queryKey: ['learning-summary'] }); } });
  const done = p.topics.filter((t) => t.done).length;
  const strip = (t: LearningPath['topics'][number]) => ({ _id: t._id, title: t.title, done: t.done, doneAt: t.doneAt, notes: t.notes, subtopics: t.subtopics });

  return (
    <section className="panel">
      <div className="flex items-start gap-3 p-5">
        <button onClick={() => setOpen((o) => !o)} className="mt-1" aria-expanded={open} aria-label={open ? 'Collapse' : 'Expand'}><ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{p.title}</h3>
            <span className="text-sm text-muted num">{done}/{p.topics.length}</span>
          </div>
          {p.description && <p className="text-sm text-muted mt-0.5">{p.description}</p>}
          <Progress value={done} max={p.topics.length || 1} className="mt-3" label={`${p.title} progress`} />
          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted">
            {p.startDate && <span>{prettyDate(p.startDate, { day: 'numeric', month: 'short' })} → {p.targetDate ? prettyDate(p.targetDate, { day: 'numeric', month: 'short' }) : '…'}</span>}
            <span className="flex items-center gap-2">Proficiency <Stars label="Proficiency" value={p.proficiency} onChange={(v) => save.mutate({ proficiency: v })} /></span>
          </div>
        </div>
        <div className="flex">
          <Button variant="ghost" size="icon" aria-label="Edit path" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label="Delete path" onClick={() => setDel(true)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line px-5 py-4 grid md:grid-cols-[1fr_260px] gap-6">
          <div>
            <ul className="space-y-1">
              {p.topics.map((t, i) => (
                <li key={t._id ?? i} className="flex items-center gap-3 group">
                  <button onClick={() => save.mutate({ topics: p.topics.map((x, j) => strip(j === i ? { ...x, done: !x.done } : x)) })} aria-pressed={t.done} aria-label={`${t.done ? 'Unmark' : 'Mark'} ${t.title}`}
                    className={cn('h-5 w-5 rounded-md border-2 grid place-items-center shrink-0', t.done ? 'bg-leaf border-leaf text-white dark:text-[#06140D]' : 'border-line hover:border-leaf')}>
                    {t.done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span className={cn('text-sm flex-1 py-1', t.done && 'text-muted line-through')}>{t.title}</span>
                  <button onClick={() => save.mutate({ topics: p.topics.filter((_, j) => j !== i).map(strip) })} className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted" aria-label={`Remove ${t.title}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); if (newTopic.trim()) { save.mutate({ topics: [...p.topics.map(strip), { title: newTopic.trim(), done: false, notes: '', subtopics: [] }] }); setNewTopic(''); } }}>
              <Input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Add topic" className="h-9" aria-label="New topic" maxLength={120} />
              <Button size="sm" variant="outline" type="submit">Add</Button>
            </form>
          </div>
          <div>
            <p className="text-xs text-muted mb-2">Resources</p>
            <ul className="space-y-1.5">
              {p.resources.map((r, i) => (
                <li key={r._id ?? i} className="flex items-center gap-2 text-sm">
                  <a href={r.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-leaf hover:underline inline-flex items-center gap-1">{r.title}<ExternalLink className="h-3 w-3 shrink-0" /></a>
                  <button onClick={() => save.mutate({ resources: p.resources.filter((_, j) => j !== i) })} aria-label={`Remove ${r.title}`} className="text-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <form className="space-y-1.5 mt-3" onSubmit={(e) => {
              e.preventDefault();
              try { new URL(res.url); } catch { return toast.error('Enter a full link starting with https://'); }
              save.mutate({ resources: [...p.resources, { title: res.title || res.url, url: res.url, kind: 'other' }] }); setRes({ title: '', url: '' });
            }}>
              <Input value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} placeholder="Title" className="h-8" aria-label="Resource title" />
              <div className="flex gap-1.5"><Input value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} placeholder="https://…" className="h-8" aria-label="Resource link" /><Button size="sm" variant="outline" type="submit">Add</Button></div>
            </form>
          </div>
        </div>
      )}
      <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit path" fields={PATH_FIELDS} initial={p} submitLabel="Save path" onSubmit={(v) => save.mutateAsync(v)} />
      <ConfirmDialog open={del} onOpenChange={setDel} title={`Delete “${p.title}”?`} description="Topics and resources in this path are removed. Study sessions stay." confirmLabel="Delete path" onConfirm={async () => { await remove.mutateAsync(); setDel(false); }} />
    </section>
  );
}

function RoadmapTab() {
  const s = useSummary();
  const paths = useList<LearningPath>('/learning/paths', { archived: 'false' });
  const m = useResourceMutations<LearningPath>('/learning/paths', { noun: 'Path', invalidate: [['learning-summary']] });
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5">
      {s.data && (
        <section className="panel p-5 sm:p-6 rounded-3xl flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm text-muted">90-day roadmap</p>
            <p className="font-display text-3xl font-semibold mt-1 num">{s.data.roadmap.day ? `Day ${Math.min(s.data.roadmap.day, 90)}` : 'Not started'}<span className="text-muted text-lg"> of 90</span></p>
            <Progress value={s.data.roadmap.day ?? 0} max={90} tone="water" className="mt-3" label="Days elapsed" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm text-muted">Topics completed</p>
            <p className="font-display text-3xl font-semibold mt-1 num">{s.data.roadmap.pct}%<span className="text-muted text-lg"> · {s.data.roadmap.doneTopics}/{s.data.roadmap.totalTopics}</span></p>
            <Progress value={s.data.roadmap.doneTopics} max={s.data.roadmap.totalTopics || 1} className="mt-3" label="Topics completed" />
          </div>
        </section>
      )}
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New learning path</Button></div>
      {paths.isLoading ? <Skeleton className="h-60" /> : paths.data?.items.map((p) => <PathCard key={p._id} p={p} />)}
      <FormDialog open={open} onOpenChange={setOpen} title="New learning path" fields={PATH_FIELDS} submitLabel="Create path" onSubmit={(v) => m.create.mutateAsync(v)} />
    </div>
  );
}

/* ---------------- Study ---------------- */
function StudyTab() {
  const today = useToday();
  const qc = useQueryClient();
  const s = useSummary();
  const paths = useList<LearningPath>('/learning/paths', { archived: 'false' });
  const sessions = useList<StudySession>('/learning/sessions', { limit: 30 });
  const m = useResourceMutations<StudySession>('/learning/sessions', { noun: 'Session', invalidate: [['learning-summary']] });
  const [pathId, setPathId] = useState('');
  const [topic, setTopic] = useState('');
  const [manual, setManual] = useState({ minutes: '', kind: 'study', notes: '' });

  const log = useCallback((minutes: number, mode: string, extra: Partial<StudySession> = {}) =>
    api.post('/learning/sessions', { date: today, minutes, mode, path: pathId || null, topic, kind: 'study', ...extra })
      .then(() => { toast.success(`Logged ${minutes} min`); qc.invalidateQueries({ queryKey: ['/learning/sessions'] }); qc.invalidateQueries({ queryKey: ['learning-summary'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); })
      .catch((e) => toast.error(apiError(e))), [today, pathId, topic, qc]);

  const target = s.data?.targetMinutes ?? 0;
  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-5 items-start">
      <div className="space-y-5">
        <Panel title="Focus timer">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Select value={pathId} onChange={(e) => setPathId(e.target.value)} aria-label="Learning path"><option value="">No path</option>{paths.data?.items.map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}</Select>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic" aria-label="Topic" maxLength={120} />
          </div>
          <StudyTimer onFinish={(min, mode) => log(min, mode)} />
        </Panel>
        <Panel title="Log manually">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const n = Number(manual.minutes); if (!(n >= 1 && n <= 720)) return toast.error('Minutes must be 1–720'); log(n, 'manual', { kind: manual.kind, notes: manual.notes }).then(() => setManual({ minutes: '', kind: manual.kind, notes: '' })); }}>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={1} max={720} placeholder="Minutes" value={manual.minutes} onChange={(e) => setManual({ ...manual, minutes: e.target.value })} aria-label="Minutes" />
              <Select value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value })} aria-label="Type"><option value="study">Study</option><option value="practice">Coding practice</option><option value="project">Project work</option></Select>
            </div>
            <Input placeholder="What did you do? (optional)" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} aria-label="Notes" />
            <Button type="submit" variant="outline" className="w-full">Log session</Button>
          </form>
        </Panel>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div className="panel p-4"><p className="text-xs text-muted">Today</p><p className="font-display text-2xl font-semibold num mt-1">{fmtMinutes(s.data?.todayMinutes ?? 0)}</p>{target > 0 && <Progress value={s.data?.todayMinutes ?? 0} max={target} className="mt-2" label="Today vs target" />}</div>
          <div className="panel p-4"><p className="text-xs text-muted">This week</p><p className="font-display text-2xl font-semibold num mt-1">{fmtMinutes(s.data?.weekMinutes ?? 0)}</p></div>
          <div className="panel p-4"><p className="text-xs text-muted">Daily target</p><p className="font-display text-2xl font-semibold num mt-1">{fmtMinutes(target)}</p></div>
        </div>
        <Panel title="Last 7 days">
          <div className="h-48 -ml-2"><ResponsiveContainer><BarChart data={s.data?.weekly ?? []}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
            <XAxis dataKey="date" tickFormatter={shortDay} tick={axisTick} tickLine={false} axisLine={false} /><YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} />
            <Tooltip {...chartTooltip} labelFormatter={(d) => prettyDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' })} formatter={(v: number) => [fmtMinutes(v), 'Studied']} />
            <Bar dataKey="minutes" fill="hsl(var(--leaf))" radius={[6, 6, 2, 2]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Session log">
          {!sessions.data?.items.length ? <p className="text-sm text-muted">No sessions yet. Start the timer or log one manually.</p> : (
            <ul className="divide-y divide-line -mx-5">
              {sessions.data.items.map((x) => (
                <li key={x._id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="font-semibold num text-sm w-14">{fmtMinutes(x.minutes)}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm truncate">{x.topic || paths.data?.items.find((p) => p._id === x.path)?.title || 'Study'}{x.notes ? ` — ${x.notes}` : ''}</p><p className="text-xs text-muted">{prettyDate(x.date, { day: 'numeric', month: 'short' })} · {x.kind} · {x.mode}</p></div>
                  <Button variant="ghost" size="icon" aria-label="Delete session" onClick={() => m.remove.mutate(x._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Projects ---------------- */
const PROJECT_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 80, full: true },
  { name: 'status', label: 'Status', type: 'select', options: [{ value: 'idea', label: 'Idea' }, { value: 'building', label: 'Building' }, { value: 'paused', label: 'Paused' }, { value: 'done', label: 'Done' }] },
  { name: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100 },
  { name: 'techStack', label: 'Tech stack', type: 'tags', placeholder: 'Python, Pandas, MongoDB', full: true },
  { name: 'repoUrl', label: 'Repository link', type: 'url', placeholder: 'https://github.com/…', full: true },
  { name: 'description', label: 'Description', type: 'textarea', max: 1000 },
];
const STATUS_TONE = { idea: 'neutral', building: 'water', paused: 'amber', done: 'leaf' } as const;
function ProjectsTab() {
  const list = useList<Project>('/learning/projects');
  const m = useResourceMutations<Project>('/learning/projects', { noun: 'Project' });
  const [edit, setEdit] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Project | null>(null);
  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New project</Button></div>
      {!list.data?.items.length && !list.isLoading ? <EmptyState icon={<FolderGit2 className="h-6 w-6" />} title="No projects yet" body="Small, finished projects teach more than big unfinished ones." /> : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.data?.items.map((p) => (
            <section key={p._id} className="panel p-5">
              <div className="flex justify-between gap-2">
                <div><h3 className="font-semibold">{p.title}</h3><Chip tone={STATUS_TONE[p.status]} className="mt-1.5">{p.status}</Chip></div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${p.title}`} onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${p.title}`} onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              {p.description && <p className="text-sm text-muted mt-3 line-clamp-3">{p.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">{p.techStack.map((t) => <Chip key={t}>{t}</Chip>)}</div>
              <div className="flex items-center gap-3 mt-4"><Progress value={p.progress} className="flex-1" label={`${p.title} progress`} /><span className="text-xs num text-muted">{p.progress}%</span></div>
              {p.repoUrl && <a href={p.repoUrl} target="_blank" rel="noreferrer" className="text-xs text-leaf inline-flex items-center gap-1 mt-3 hover:underline">Repository <ExternalLink className="h-3 w-3" /></a>}
            </section>
          ))}
        </div>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit project' : 'New project'} fields={PROJECT_FIELDS} initial={edit ?? { progress: 0 }} submitLabel={edit ? 'Save project' : 'Add project'}
        onSubmit={(v) => { const body = { ...v, progress: v.progress ?? 0 }; return edit ? m.update.mutateAsync({ id: edit._id, body }) : m.create.mutateAsync(body); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.title}”?`} description="This can't be undone." confirmLabel="Delete project" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}

export default function LearningPage() {
  const [tab, setTab] = useState('roadmap');
  return (
    <div>
      <PageHeader title="Learning" subtitle="Python → automation → AI, one topic at a time." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'roadmap', label: 'Roadmap' }, { v: 'study', label: 'Study & practice' }, { v: 'projects', label: 'Projects' }]}>
        <TabPanel value="roadmap"><RoadmapTab /></TabPanel>
        <TabPanel value="study"><StudyTab /></TabPanel>
        <TabPanel value="projects"><ProjectsTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
