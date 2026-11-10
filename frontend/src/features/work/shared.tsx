import { useQueryClient } from '@tanstack/react-query';
import { useList } from '@/hooks/useResource';
import { Chip } from '@/components/ui/kit';
import type { Stakeholder, WorkPriority, WorkProject, WorkTask } from '@/types';

export const PRIORITY_OPTS = [{ value: 'urgent', label: 'Urgent' }, { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }];
export const PROJECT_STATUS = { planning: 'Planning', in_progress: 'In progress', on_hold: 'On hold', live: 'Live', done: 'Done' } as const;
export const TASK_STATUS = { todo: 'To do', in_progress: 'In progress', blocked: 'Blocked', done: 'Done' } as const;
export const REQ_STATUS = { new: 'New', accepted: 'Accepted', in_progress: 'In progress', delivered: 'Delivered', rejected: 'Rejected' } as const;

export const useProjects = (includeArchived = false) => useList<WorkProject>('/work/projects', { limit: 200, ...(includeArchived ? {} : { archived: 'false' }) });
export const useStakeholders = () => useList<Stakeholder>('/work/stakeholders', { limit: 500 });

/** Everything that might change when any work record changes. */
export function useWorkInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const k of ['/work/tasks', '/work/requirements', '/work/meetings', '/work/logs', '/work/changes', '/work/projects', 'work-board', 'work-day', 'work-report', 'work-project', 'dashboard'])
      qc.invalidateQueries({ queryKey: [k] });
  };
}

export const projectOptions = (projects: WorkProject[] | undefined, none = 'No project') =>
  [{ value: '', label: none }, ...(projects ?? []).map((p) => ({ value: p._id, label: p.name }))];

export const projectNameOf = (p: WorkTask['project'], projects?: WorkProject[]) =>
  !p ? null : typeof p === 'string' ? projects?.find((x) => x._id === p)?.name ?? null : p.name;

export function PriorityChip({ p }: { p: WorkPriority }) {
  const tone = p === 'urgent' ? 'danger' : p === 'high' ? 'amber' : 'neutral';
  return <Chip tone={tone}>{p}</Chip>;
}

export function DueChip({ due, today, done }: { due: string | null; today: string; done?: boolean }) {
  if (!due) return null;
  const late = !done && due < today;
  const label = due === today ? 'today' : new Date(due + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return <Chip tone={late ? 'danger' : due === today && !done ? 'amber' : 'neutral'}>{late ? 'overdue · ' : 'due '}{label}</Chip>;
}

/** Empty strings from selects → null for optional references/dates. */
export const nullify = <T extends Record<string, unknown>>(v: T, keys: string[]) => {
  const out: Record<string, unknown> = { ...v };
  for (const k of keys) if (out[k] === '' || out[k] === undefined) out[k] = null;
  return out;
};
