import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Archive, ExternalLink, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { get } from '@/lib/resource';
import { useResourceMutations } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Chip, Progress } from '@/components/ui/kit';
import { fmtMinutes, prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { ChangeEntry, Meeting, Requirement, Stakeholder, WorkProject } from '@/types';
import { PRIORITY_OPTS, PROJECT_STATUS, PriorityChip, REQ_STATUS, nullify, useProjects, useStakeholders, useWorkInvalidate } from './shared';

const STATUS_TONE = { planning: 'neutral', in_progress: 'water', on_hold: 'amber', live: 'leaf', done: 'leaf' } as const;

/** Links are edited as "Label | https://…" lines — simple on a phone keyboard. */
const linksToText = (l: WorkProject['links']) => l.map((x) => `${x.label} | ${x.url}`).join('\n');
const textToLinks = (t: string) => t.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
  const [a, ...rest] = line.split('|');
  const url = (rest.length ? rest.join('|') : a).trim();
  return { label: (rest.length ? a : url.replace(/^https?:\/\//, '').split('/')[0]).trim().slice(0, 60), url };
});

export function ProjectForm({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: WorkProject | null }) {
  const stakeholders = useStakeholders();
  const invalidate = useWorkInvalidate();
  const m = useResourceMutations<WorkProject>('/work/projects', { noun: 'Project' });
  const fields: FieldDef[] = [
    { name: 'name', label: 'Project name', type: 'text', required: true, max: 100, full: true },
    { name: 'department', label: 'Department', type: 'text', max: 60, placeholder: 'Design, Accounts, Sales…' },
    { name: 'status', label: 'Status', type: 'select', options: Object.entries(PROJECT_STATUS).map(([value, label]) => ({ value, label })) },
    { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTS },
    { name: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100 },
    { name: 'startDate', label: 'Start', type: 'date' },
    { name: 'targetDate', label: 'Target', type: 'date' },
    { name: 'stakeholders', label: 'Stakeholders', type: 'multiselect', options: (stakeholders.data?.items ?? []).map((s) => ({ value: s._id, label: s.name })), hint: 'Add people in the People tab first.' },
    { name: 'techStack', label: 'Tech stack', type: 'tags', placeholder: 'Node.js, MongoDB, React', full: true },
    { name: 'links', label: 'Links (one per line: Label | URL)', type: 'textarea', placeholder: 'Repo | https://github.com/…\nDashboard | https://…' },
    { name: 'description', label: 'Description', type: 'textarea', max: 2000 },
  ];
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={project ? 'Edit project' : 'New project'} fields={fields} submitLabel={project ? 'Save project' : 'Create project'}
      initial={project ? { ...project, links: linksToText(project.links) } : { status: 'planning', priority: 'medium', progress: 0 }}
      onSubmit={async (v) => {
        const body = nullify({ ...v, progress: v.progress ?? 0, links: textToLinks(String(v.links ?? '')) }, ['startDate', 'targetDate']);
        if (project) await m.update.mutateAsync({ id: project._id, body }); else await m.create.mutateAsync(body);
        invalidate();
      }} />
  );
}

type Summary = { project: Omit<WorkProject, 'stakeholders'> & { stakeholders: Stakeholder[] }; tasks: Record<string, number>; requirements: Requirement[]; meetings: Meeting[]; changes: ChangeEntry[]; totalMinutes: number };

export function ProjectDetail({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (p: WorkProject) => void }) {
  const q = useQuery({ queryKey: ['work-project', id], queryFn: () => get<Summary>(`/work/projects/${id}/summary`), enabled: !!id });
  const s = q.data;
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()} title={s?.project.name ?? 'Project'} className="sm:w-[min(96vw,820px)]">
      {!s ? <Skeleton className="h-60" /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={STATUS_TONE[s.project.status]}>{PROJECT_STATUS[s.project.status]}</Chip>
            <PriorityChip p={s.project.priority} />
            {s.project.department && <Chip>{s.project.department}</Chip>}
            {s.project.targetDate && <span className="text-xs text-muted">Target {prettyDate(s.project.targetDate, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(s.project as unknown as WorkProject)}><Pencil className="h-4 w-4" />Edit</Button>
          </div>
          <div className="flex items-center gap-3"><Progress value={s.project.progress} className="flex-1" label="Progress" /><span className="text-sm font-semibold num">{s.project.progress}%</span></div>
          {s.project.description && <p className="text-sm text-muted whitespace-pre-wrap">{s.project.description}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[['To do', s.tasks.todo], ['In progress', s.tasks.in_progress], ['Blocked', s.tasks.blocked], ['Done', s.tasks.done], ['Time', fmtMinutes(s.totalMinutes)]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sunken py-2"><p className="text-[11px] text-muted">{k}</p><p className="font-semibold num">{v}</p></div>
            ))}
          </div>
          {(s.project.links.length > 0 || s.project.stakeholders.length > 0 || s.project.techStack.length > 0) && (
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              {s.project.links.length > 0 && <div><p className="text-xs text-muted mb-1">Links</p>{s.project.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-leaf hover:underline truncate">{l.label}<ExternalLink className="h-3 w-3 shrink-0" /></a>)}</div>}
              {s.project.stakeholders.length > 0 && <div><p className="text-xs text-muted mb-1">Stakeholders</p>{s.project.stakeholders.map((p) => <p key={p._id}>{p.name}<span className="text-muted">{p.role ? ` · ${p.role}` : ''}</span></p>)}</div>}
              {s.project.techStack.length > 0 && <div><p className="text-xs text-muted mb-1">Tech</p><div className="flex flex-wrap gap-1">{s.project.techStack.map((t) => <Chip key={t}>{t}</Chip>)}</div></div>}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-sm font-semibold mb-2">Requirements</p>
              {!s.requirements.length ? <p className="text-xs text-muted">None yet.</p> : <ul className="space-y-1.5">{s.requirements.map((r) => <li key={r._id} className="text-sm flex gap-2"><span className="flex-1 truncate">{r.title}</span><Chip>{REQ_STATUS[r.status]}</Chip></li>)}</ul>}
              <p className="text-sm font-semibold mt-4 mb-2">Meetings</p>
              {!s.meetings.length ? <p className="text-xs text-muted">None yet.</p> : <ul className="space-y-1.5">{s.meetings.map((m) => <li key={m._id} className="text-sm flex gap-2"><span className="flex-1 truncate">{m.title}</span><span className="text-xs text-muted">{prettyDate(m.date, { day: 'numeric', month: 'short' })}</span></li>)}</ul>}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Change log</p>
              {!s.changes.length ? <p className="text-xs text-muted">No releases logged.</p> : (
                <ol className="space-y-2 border-l-2 border-line pl-3">{s.changes.map((c) => (
                  <li key={c._id} className="text-sm"><p className="text-xs text-muted">{prettyDate(c.date, { day: 'numeric', month: 'short' })} · {c.environment.toUpperCase()}{c.version ? ` · ${c.version}` : ''} · {c.type}</p><p>{c.summary}</p></li>
                ))}</ol>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export default function Projects() {
  const [showArchived, setShowArchived] = useState('active');
  const list = useProjects(showArchived === 'all');
  const m = useResourceMutations<WorkProject>('/work/projects', { noun: 'Project' });
  const invalidate = useWorkInvalidate();
  const [edit, setEdit] = useState<WorkProject | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [del, setDel] = useState<WorkProject | null>(null);
  const items = list.data?.items ?? [];
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={showArchived} onChange={(e) => setShowArchived(e.target.value)} className="w-44" aria-label="Show"><option value="active">Active projects</option><option value="all">Include archived</option></Select>
        <Button className="ml-auto" onClick={() => { setEdit(null); setFormOpen(true); }}><Plus className="h-4 w-4" />New project</Button>
      </div>
      {list.isLoading ? <Skeleton className="h-48" /> : !items.length ? (
        <EmptyState icon={<FolderKanban className="h-6 w-6" />} title="No projects yet" body="Create one per thing you're building — a dashboard, a report, an automation." action={<Button onClick={() => setFormOpen(true)}>Create a project</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <section key={p._id} className={cn('panel p-5 flex flex-col', p.archived && 'opacity-60')}>
              <div className="flex items-start gap-2">
                <button className="flex-1 text-left" onClick={() => setDetail(p._id)}>
                  <h3 className="font-semibold hover:text-leaf">{p.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2"><Chip tone={STATUS_TONE[p.status]}>{PROJECT_STATUS[p.status]}</Chip>{p.priority !== 'medium' && <PriorityChip p={p.priority} />}{p.department && <Chip>{p.department}</Chip>}{p.archived && <Chip>archived</Chip>}</div>
                </button>
                <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => { setEdit(p); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              </div>
              {p.description && <p className="text-sm text-muted mt-3 line-clamp-2">{p.description}</p>}
              <div className="flex items-center gap-3 mt-auto pt-4"><Progress value={p.progress} className="flex-1" label={`${p.name} progress`} /><span className="text-xs num text-muted">{p.progress}%</span></div>
              <div className="flex items-center justify-between mt-3 text-xs text-muted">
                <span>{p.targetDate ? `Target ${prettyDate(p.targetDate, { day: 'numeric', month: 'short' })}` : 'No target date'}</span>
                <span className="flex">
                  <Button variant="ghost" size="sm" onClick={() => m.update.mutate({ id: p._id, body: { archived: !p.archived } }, { onSuccess: invalidate })}><Archive className="h-3.5 w-3.5" />{p.archived ? 'Restore' : 'Archive'}</Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
            </section>
          ))}
        </div>
      )}
      <ProjectForm open={formOpen} onOpenChange={setFormOpen} project={edit} />
      <ProjectDetail id={detail} onClose={() => setDetail(null)} onEdit={(p) => { setDetail(null); setEdit(p); setFormOpen(true); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name}”?`}
        description="Its change log is deleted. Tasks, logs, requirements and meetings are kept without a project. Archive instead to keep everything."
        confirmLabel="Delete project" onConfirm={async () => { if (del) { await m.remove.mutateAsync(del._id); invalidate(); } setDel(null); }} />
    </div>
  );
}
