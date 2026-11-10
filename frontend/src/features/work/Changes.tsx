import { useState } from 'react';
import { GitCommitHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Chip } from '@/components/ui/kit';
import { prettyDate } from '@/lib/date';
import type { ChangeEntry } from '@/types';
import { useProjects, useWorkInvalidate } from './shared';

const ENV_TONE = { dev: 'neutral', uat: 'amber', live: 'leaf' } as const;

export default function Changes() {
  const today = useToday();
  const projects = useProjects(true);
  const invalidate = useWorkInvalidate();
  const [project, setProject] = useState('');
  const list = useList<ChangeEntry>('/work/changes', { limit: 200, project: project || undefined });
  const m = useResourceMutations<ChangeEntry>('/work/changes', { noun: 'Change' });
  const [edit, setEdit] = useState<ChangeEntry | null>(null);
  const [open, setOpen] = useState(false);
  const pOpts = (projects.data?.items ?? []).map((p) => ({ value: p._id, label: p.name }));
  const fields: FieldDef[] = [
    { name: 'project', label: 'Project', type: 'select', options: pOpts },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'version', label: 'Version', type: 'text', max: 30, placeholder: 'v1.2' },
    { name: 'type', label: 'Type', type: 'select', options: [{ value: 'feature', label: 'Feature' }, { value: 'fix', label: 'Fix' }, { value: 'config', label: 'Config' }, { value: 'data', label: 'Data' }] },
    { name: 'environment', label: 'Where', type: 'select', options: [{ value: 'live', label: 'Live' }, { value: 'uat', label: 'UAT' }, { value: 'dev', label: 'Dev' }] },
    { name: 'summary', label: 'What changed', type: 'textarea', required: true, max: 1000 },
  ];
  const name = (id: string) => projects.data?.items.find((p) => p._id === id)?.name ?? 'Deleted project';
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-52" aria-label="Project"><option value="">All projects</option>{pOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        <Button className="ml-auto" disabled={!pOpts.length} onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Log change</Button>
      </div>
      {list.isLoading ? <Skeleton className="h-40" /> : !list.data?.items.length ? (
        <EmptyState icon={<GitCommitHorizontal className="h-6 w-6" />} title={pOpts.length ? 'No changes logged' : 'Create a project first'} body="Log every deploy or config change. When something breaks next month, you'll know what changed and when." />
      ) : (
        <ol className="panel divide-y divide-line">
          {list.data.items.map((c) => (
            <li key={c._id} className="px-5 py-3 flex items-start gap-3">
              <div className="w-16 text-xs text-muted pt-0.5">{prettyDate(c.date, { day: 'numeric', month: 'short' })}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5 items-center"><span className="text-sm font-medium">{name(c.project)}</span>{c.version && <Chip>{c.version}</Chip>}<Chip tone={ENV_TONE[c.environment]}>{c.environment.toUpperCase()}</Chip><Chip>{c.type}</Chip></div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{c.summary}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Edit change" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
              <Button variant="ghost" size="icon" aria-label="Delete change" onClick={() => m.remove.mutate(c._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
            </li>
          ))}
        </ol>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit change' : 'Log a change'} fields={fields} submitLabel={edit ? 'Save' : 'Log change'}
        initial={edit ?? { project: project || pOpts[0]?.value, date: today, type: 'feature', environment: 'live' }}
        onSubmit={async (v) => { if (edit) await m.update.mutateAsync({ id: edit._id, body: v }); else await m.create.mutateAsync(v); invalidate(); }} />
    </div>
  );
}
