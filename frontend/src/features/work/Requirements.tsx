import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClipboardList, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Chip } from '@/components/ui/kit';
import { prettyDate } from '@/lib/date';
import type { Requirement } from '@/types';
import { PRIORITY_OPTS, PriorityChip, REQ_STATUS, nullify, projectOptions, useProjects, useStakeholders, useWorkInvalidate } from './shared';

const TONE = { new: 'amber', accepted: 'water', in_progress: 'water', delivered: 'leaf', rejected: 'neutral' } as const;

export default function Requirements() {
  const today = useToday();
  const projects = useProjects();
  const stakeholders = useStakeholders();
  const invalidate = useWorkInvalidate();
  const [status, setStatus] = useState('open');
  const [q, setQ] = useState('');
  const list = useList<Requirement>('/work/requirements', { limit: 200, q: q || undefined, ...(status === 'open' || status === 'all' ? {} : { status }) });
  const m = useResourceMutations<Requirement>('/work/requirements', { noun: 'Requirement' });
  const [edit, setEdit] = useState<Requirement | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Requirement | null>(null);
  const toTask = useMutation({
    mutationFn: (id: string) => api.post(`/work/requirements/${id}/task`, {}),
    onSuccess: () => { invalidate(); toast.success('Task created on the board'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const items = (list.data?.items ?? []).filter((r) => status !== 'open' || !['delivered', 'rejected'].includes(r.status));
  const shName = (id: string | null) => stakeholders.data?.items.find((s) => s._id === id)?.name;
  const prName = (id: string | null) => projects.data?.items.find((p) => p._id === id)?.name;

  const fields: FieldDef[] = [
    { name: 'title', label: 'What is needed?', type: 'text', required: true, max: 200, full: true },
    { name: 'stakeholder', label: 'Requested by', type: 'select', options: [{ value: '', label: 'Someone else (type below)' }, ...(stakeholders.data?.items ?? []).map((s) => ({ value: s._id, label: s.name }))] },
    { name: 'requestedBy', label: 'Name (if not in People)', type: 'text', max: 80 },
    { name: 'department', label: 'Department', type: 'text', max: 60 },
    { name: 'project', label: 'Project', type: 'select', options: projectOptions(projects.data?.items) },
    { name: 'date', label: 'Received on', type: 'date', required: true },
    { name: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTS },
    { name: 'status', label: 'Status', type: 'select', options: Object.entries(REQ_STATUS).map(([value, label]) => ({ value, label })) },
    { name: 'details', label: 'Details', type: 'textarea', max: 3000 },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Search requirements" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Status">
          <option value="open">Open</option>{Object.entries(REQ_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}<option value="all">All</option>
        </Select>
        <Button className="ml-auto" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Log requirement</Button>
      </div>
      {list.isLoading ? <Skeleton className="h-48" /> : !items.length ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="No requirements here" body="Log every ask the moment it comes in — over chat, call or in a meeting — so nothing slips." />
      ) : (
        <div className="panel overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <li key={r._id} className="px-5 py-3 flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[220px]">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted mt-0.5">{[shName(r.stakeholder) ?? r.requestedBy, r.department, prName(r.project)].filter(Boolean).join(' · ') || '—'} · {prettyDate(r.date, { day: 'numeric', month: 'short' })}</p>
                  <div className="flex gap-1.5 mt-2"><Chip tone={TONE[r.status]}>{REQ_STATUS[r.status]}</Chip>{r.priority !== 'medium' && <PriorityChip p={r.priority} />}{r.task && <Chip tone="leaf">task on board</Chip>}</div>
                </div>
                <div className="flex items-center gap-1">
                  {!r.task && !['delivered', 'rejected'].includes(r.status) && <Button size="sm" variant="outline" loading={toTask.isPending && toTask.variables === r._id} onClick={() => toTask.mutate(r._id)}><ListPlus className="h-4 w-4" />Make task</Button>}
                  <Select value={r.status} onChange={(e) => m.update.mutate({ id: r._id, body: { status: e.target.value } }, { onSuccess: invalidate })} className="w-32 h-8 text-xs" aria-label="Change status">
                    {Object.entries(REQ_STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Button variant="ghost" size="icon" aria-label="Edit requirement" onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Delete requirement" onClick={() => setDel(r)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit requirement' : 'Log requirement'} fields={fields} submitLabel={edit ? 'Save' : 'Log it'}
        initial={edit ? { ...edit, stakeholder: edit.stakeholder ?? '', project: edit.project ?? '' } : { date: today, priority: 'medium', status: 'new', stakeholder: '', project: '' }}
        onSubmit={async (v) => {
          const body = nullify(v, ['stakeholder', 'project']);
          if (edit) await m.update.mutateAsync({ id: edit._id, body }); else await m.create.mutateAsync(body);
          invalidate();
        }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this requirement?" description="A task made from it stays on the board." confirmLabel="Delete" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}
