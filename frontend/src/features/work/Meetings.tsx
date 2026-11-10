import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, Check, ListPlus, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { useList, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Chip } from '@/components/ui/kit';
import { prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types';
import { nullify, projectOptions, useProjects, useStakeholders, useWorkInvalidate } from './shared';

type Draft = Omit<Meeting, '_id'>;
const ta = 'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-leaf';

function MeetingEditor({ open, onOpenChange, meeting }: { open: boolean; onOpenChange: (o: boolean) => void; meeting: Meeting | null }) {
  const today = useToday();
  const projects = useProjects();
  const stakeholders = useStakeholders();
  const invalidate = useWorkInvalidate();
  const [d, setD] = useState<Draft>({ title: '', date: today, project: null, attendees: [], notes: '', decisions: '', actionItems: [] });
  useEffect(() => {
    if (open) setD(meeting ? { ...meeting, actionItems: meeting.actionItems.map((a) => ({ ...a })) } : { title: '', date: today, project: null, attendees: [], notes: '', decisions: '', actionItems: [] });
  }, [open, meeting, today]);
  const save = useMutation({
    mutationFn: () => {
      const body = nullify({ ...d, project: d.project || null, actionItems: d.actionItems.filter((a) => a.text.trim()).map((a) => nullify(a, ['dueDate'])) }, ['project']);
      return meeting ? api.patch(`/work/meetings/${meeting._id}`, body) : api.post('/work/meetings', body);
    },
    onSuccess: () => { invalidate(); toast.success('Meeting saved'); onOpenChange(false); },
    onError: (e) => toast.error(apiError(e)),
  });
  const setItem = (i: number, patch: Partial<Draft['actionItems'][number]>) => setD({ ...d, actionItems: d.actionItems.map((a, j) => j === i ? { ...a, ...patch } : a) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={meeting ? 'Edit meeting' : 'New meeting notes'} className="sm:w-[min(96vw,700px)]">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!d.title.trim()) return toast.error('Give the meeting a title'); save.mutate(); }}>
        <div className="grid sm:grid-cols-[1fr_160px] gap-3">
          <Field label="Title" htmlFor="m-title"><Input id="m-title" autoFocus value={d.title} maxLength={150} placeholder="Design MIS kickoff" onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
          <Field label="Date" htmlFor="m-date"><Input id="m-date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} /></Field>
        </div>
        <Field label="Project" htmlFor="m-proj"><Select id="m-proj" value={d.project ?? ''} onChange={(e) => setD({ ...d, project: e.target.value || null })}>{projectOptions(projects.data?.items).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
        <fieldset>
          <legend className="field-label mb-1.5">Attendees</legend>
          {!stakeholders.data?.items.length ? <p className="hint">Add people in the People tab to tag them here.</p> : (
            <div className="flex flex-wrap gap-1.5">{stakeholders.data.items.map((s) => {
              const on = d.attendees.includes(s._id);
              return <button type="button" key={s._id} aria-pressed={on} onClick={() => setD({ ...d, attendees: on ? d.attendees.filter((x) => x !== s._id) : [...d.attendees, s._id] })}
                className={cn('h-8 px-3 rounded-full text-sm border', on ? 'bg-leaf-soft text-leaf-ink border-leaf/40' : 'border-line text-muted hover:bg-sunken')}>{s.name}</button>;
            })}</div>
          )}
        </fieldset>
        <Field label="Notes" htmlFor="m-notes"><textarea id="m-notes" rows={5} className={ta} value={d.notes} maxLength={10000} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
        <Field label="Decisions" htmlFor="m-dec"><textarea id="m-dec" rows={2} className={ta} value={d.decisions} maxLength={3000} placeholder="What was agreed?" onChange={(e) => setD({ ...d, decisions: e.target.value })} /></Field>
        <fieldset>
          <legend className="field-label mb-1.5">Action items</legend>
          <ul className="space-y-2">
            {d.actionItems.map((a, i) => (
              <li key={a._id ?? i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_140px_auto] gap-2">
                <Input placeholder="What needs to happen" value={a.text} maxLength={300} onChange={(e) => setItem(i, { text: e.target.value })} aria-label="Action item" disabled={!!a.task} />
                <Button type="button" variant="ghost" size="icon" className="sm:order-last" aria-label="Remove action item" onClick={() => setD({ ...d, actionItems: d.actionItems.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                <Input placeholder="Owner" value={a.assignee} maxLength={60} onChange={(e) => setItem(i, { assignee: e.target.value })} aria-label="Owner" />
                <Input type="date" value={a.dueDate ?? ''} onChange={(e) => setItem(i, { dueDate: e.target.value || null })} aria-label="Due date" />
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setD({ ...d, actionItems: [...d.actionItems, { text: '', assignee: 'me', dueDate: null, task: null }] })}><Plus className="h-4 w-4" />Add action item</Button>
          <p className="hint mt-2">Save the meeting, then turn any action item into a task from the list.</p>
        </fieldset>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={save.isPending}>Save meeting</Button></div>
      </form>
    </Dialog>
  );
}

export default function Meetings() {
  const projects = useProjects();
  const stakeholders = useStakeholders();
  const invalidate = useWorkInvalidate();
  const [q, setQ] = useState('');
  const list = useList<Meeting>('/work/meetings', { limit: 100, q: q || undefined });
  const [edit, setEdit] = useState<Meeting | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Meeting | null>(null);
  const toTask = useMutation({
    mutationFn: ({ m, a }: { m: string; a: string }) => api.post(`/work/meetings/${m}/actions/${a}/task`, {}),
    onSuccess: () => { invalidate(); toast.success('Task created on the board'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/work/meetings/${id}`), onSuccess: () => { invalidate(); setDel(null); } });
  const name = (id: string) => stakeholders.data?.items.find((s) => s._id === id)?.name;
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Search notes" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search meetings" />
        <Button className="ml-auto" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New meeting</Button>
      </div>
      {list.isLoading ? <Skeleton className="h-48" /> : !list.data?.items.length ? (
        <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No meeting notes" body="Jot decisions and action items during the meeting; turn the action items into tasks after." />
      ) : (
        <div className="space-y-4">
          {list.data.items.map((m) => (
            <article key={m._id} className="panel p-5">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="text-xs text-muted mt-0.5">{prettyDate(m.date, { weekday: 'short', day: 'numeric', month: 'short' })}{m.project ? ` · ${projects.data?.items.find((p) => p._id === m.project)?.name ?? ''}` : ''}</p>
                  {m.attendees.length > 0 && <p className="text-xs text-muted mt-1 flex items-center gap-1"><Users className="h-3 w-3" />{m.attendees.map(name).filter(Boolean).join(', ')}</p>}
                </div>
                <Button variant="ghost" size="icon" aria-label="Edit meeting" onClick={() => { setEdit(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete meeting" onClick={() => setDel(m)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {m.notes && <p className="text-sm mt-3 whitespace-pre-wrap line-clamp-6">{m.notes}</p>}
              {m.decisions && <div className="mt-3 rounded-xl bg-leaf-soft/50 px-3 py-2 text-sm"><span className="text-xs font-medium text-leaf-ink">Decisions · </span>{m.decisions}</div>}
              {m.actionItems.length > 0 && (
                <ul className="mt-3 divide-y divide-line">
                  {m.actionItems.map((a) => (
                    <li key={a._id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="text-sm flex-1 min-w-[160px]">{a.text}</span>
                      {a.assignee && a.assignee !== 'me' && <Chip>{a.assignee}</Chip>}
                      {a.dueDate && <Chip>{prettyDate(a.dueDate, { day: 'numeric', month: 'short' })}</Chip>}
                      {a.task ? <Chip tone="leaf"><Check className="h-3 w-3" />task</Chip>
                        : <Button size="sm" variant="outline" onClick={() => toTask.mutate({ m: m._id, a: a._id! })}><ListPlus className="h-4 w-4" />Make task</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
      <MeetingEditor open={open} onOpenChange={setOpen} meeting={edit} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.title}”?`} description="Tasks already created from it stay on the board." confirmLabel="Delete meeting" onConfirm={() => { if (del) remove.mutate(del._id); }} />
    </div>
  );
}
