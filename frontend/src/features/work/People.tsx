import { useState } from 'react';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useResourceMutations } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import type { Stakeholder } from '@/types';
import { useProjects, useStakeholders, useWorkInvalidate } from './shared';

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 80, full: true },
  { name: 'department', label: 'Department', type: 'text', max: 60 },
  { name: 'role', label: 'Role', type: 'text', max: 60, placeholder: 'HOD, Manager…' },
  { name: 'note', label: 'Note', type: 'text', max: 300, full: true, placeholder: 'Prefers updates on Fridays' },
];

export default function People() {
  const list = useStakeholders();
  const projects = useProjects(true);
  const invalidate = useWorkInvalidate();
  const m = useResourceMutations<Stakeholder>('/work/stakeholders', { noun: 'Person' });
  const [edit, setEdit] = useState<Stakeholder | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Stakeholder | null>(null);
  const projectsOf = (id: string) => (projects.data?.items ?? []).filter((p) => p.stakeholders.includes(id)).map((p) => p.name);
  const groups = Object.entries((list.data?.items ?? []).reduce<Record<string, Stakeholder[]>>((a, s) => { (a[s.department || 'Other'] ??= []).push(s); return a; }, {}));
  return (
    <div>
      <div className="flex mb-4"><p className="text-sm text-muted">Names and roles only — no phone numbers or emails are stored.</p><Button className="ml-auto" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Add person</Button></div>
      {list.isLoading ? <Skeleton className="h-40" /> : !groups.length ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No stakeholders yet" body="Add the people who ask for or review your work. Link them to projects, requirements and meetings." />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {groups.map(([dept, people]) => (
            <section key={dept} className="panel">
              <h3 className="text-sm font-semibold px-5 pt-4 pb-2">{dept} <span className="text-muted font-normal">· {people.length}</span></h3>
              <ul className="divide-y divide-line">
                {people.map((s) => (
                  <li key={s._id} className="flex items-start gap-2 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{s.name}{s.role && <span className="text-muted font-normal"> · {s.role}</span>}</p>
                      {projectsOf(s._id).length > 0 && <p className="text-xs text-muted truncate">{projectsOf(s._id).join(', ')}</p>}
                      {s.note && <p className="text-xs text-muted mt-0.5">{s.note}</p>}
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Edit ${s.name}`} onClick={() => { setEdit(s); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${s.name}`} onClick={() => setDel(s)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit person' : 'Add person'} fields={FIELDS} initial={edit ?? undefined} submitLabel={edit ? 'Save' : 'Add'}
        onSubmit={async (v) => { if (edit) await m.update.mutateAsync({ id: edit._id, body: v }); else await m.create.mutateAsync(v); invalidate(); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Remove ${del?.name}?`} description="They're unlinked from projects and meetings; requirements keep their name as text."
        confirmLabel="Remove" onConfirm={async () => { if (del) { await m.remove.mutateAsync(del._id); invalidate(); } setDel(null); }} />
    </div>
  );
}
