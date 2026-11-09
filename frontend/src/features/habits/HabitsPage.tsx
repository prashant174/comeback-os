import { useState } from 'react';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Check, CircleCheckBig, Flame, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useHabitMutations, useHabits, useHeatmap, useToggleHabit } from '@/hooks/queries';
import { HabitFormDialog, type HabitFormValues } from './HabitFormDialog';
import { Heatmap } from './Heatmap';
import { HabitIcon } from '@/components/HabitIcon';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { apiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Habit } from '@/types';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function HabitRow({ h, index, total, onEdit, onDelete, onMove }: {
  h: Habit; index: number; total: number; onEdit: () => void; onDelete: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const toggle = useToggleHabit();
  const { update } = useHabitMutations();
  return (
    <li className="flex items-center gap-3 sm:gap-4 py-3 px-4 sm:px-5">
      <button disabled={!h.scheduledToday} onClick={() => toggle.mutate({ id: h._id, completed: !h.completedToday })}
        aria-pressed={h.completedToday} aria-label={`${h.completedToday ? 'Unmark' : 'Mark'} ${h.name}`}
        title={h.scheduledToday ? undefined : 'Not scheduled today'}
        className={cn('h-7 w-7 rounded-lg border-2 grid place-items-center shrink-0 transition-colors disabled:opacity-40',
          h.completedToday ? 'bg-leaf border-leaf text-white dark:text-[#06140D]' : 'border-line hover:border-leaf')}>
        {h.completedToday && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <div className="h-9 w-9 rounded-xl bg-sunken grid place-items-center shrink-0 text-muted"><HabitIcon name={h.icon} className="h-4 w-4" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{h.name}</p>
        <p className="text-xs text-muted truncate capitalize">{h.category}{h.frequency === 'weekly' ? ` · ${h.daysOfWeek.map((d) => DOW[d]).join(' ')}` : ''}</p>
      </div>
      <div className="hidden sm:flex gap-1" aria-label="Last 7 days">
        {h.last7.map((d) => (
          <span key={d.date} title={d.date} className={cn('h-2.5 w-2.5 rounded-full', !d.scheduled ? 'bg-transparent border border-line' : d.done ? 'bg-leaf' : 'bg-sunken')} />
        ))}
      </div>
      <div className="w-14 text-right text-sm num flex items-center justify-end gap-1" title={`Best: ${h.streak.best}`}>
        <Flame className={cn('h-3.5 w-3.5', h.streak.current ? 'text-amber' : 'text-line')} />{h.streak.current}
      </div>
      <DM.Root>
        <DM.Trigger asChild><Button variant="ghost" size="icon" aria-label={`Options for ${h.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={4} className="z-50 min-w-[180px] panel shadow-xl p-1.5 text-sm">
            {[
              { label: 'Edit', icon: Pencil, fn: onEdit },
              ...(index > 0 ? [{ label: 'Move up', icon: ArrowUp, fn: () => onMove(-1) }] : []),
              ...(index < total - 1 ? [{ label: 'Move down', icon: ArrowDown, fn: () => onMove(1) }] : []),
              { label: h.archived ? 'Restore' : 'Archive', icon: h.archived ? ArchiveRestore : Archive, fn: () => update.mutate({ id: h._id, body: { archived: !h.archived } }) },
            ].map((it) => (
              <DM.Item key={it.label} onSelect={it.fn} className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none data-[highlighted]:bg-sunken cursor-pointer">
                <it.icon className="h-4 w-4" />{it.label}
              </DM.Item>
            ))}
            <DM.Separator className="h-px bg-line my-1" />
            <DM.Item onSelect={onDelete} className="flex items-center gap-2 px-3 py-2 rounded-lg outline-none data-[highlighted]:bg-danger-soft text-danger cursor-pointer">
              <Trash2 className="h-4 w-4" />Delete
            </DM.Item>
          </DM.Content>
        </DM.Portal>
      </DM.Root>
    </li>
  );
}

export default function HabitsPage() {
  const [showArchived, setShowArchived] = useState(false);
  const q = useHabits(showArchived);
  const heat = useHeatmap();
  const m = useHabitMutations();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const active = q.data?.filter((h) => !h.archived) ?? [];
  const archived = q.data?.filter((h) => h.archived) ?? [];
  const todayDone = active.filter((h) => h.scheduledToday && h.completedToday).length;
  const todayTotal = active.filter((h) => h.scheduledToday).length;

  const move = (i: number, dir: -1 | 1) => {
    const ids = active.map((h) => h._id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    m.reorder.mutate(ids);
  };

  const submit = (v: HabitFormValues) =>
    editing ? m.update.mutateAsync({ id: editing._id, body: v }) : m.create.mutateAsync(v);

  return (
    <div>
      <PageHeader title="Habits" subtitle={todayTotal ? `${todayDone} of ${todayTotal} done today` : 'Small things, done daily.'}
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" />New habit</Button>} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
        <section className="panel overflow-hidden">
          {q.isLoading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : q.isError ? (
            <div className="p-5"><ErrorState message={apiError(q.error)} onRetry={() => q.refetch()} /></div>
          ) : active.length === 0 ? (
            <EmptyState icon={<CircleCheckBig className="h-6 w-6" />} title="No habits yet" body="Start with one habit you can do every day, even on a bad day."
              action={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4" />Add your first habit</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {active.map((h, i) => (
                <HabitRow key={h._id} h={h} index={i} total={active.length}
                  onEdit={() => { setEditing(h); setFormOpen(true); }} onDelete={() => setDeleting(h)} onMove={(dir) => move(i, dir)} />
              ))}
            </ul>
          )}
          <div className="border-t border-line px-5 py-3">
            <button onClick={() => setShowArchived((s) => !s)} className="text-sm text-muted hover:text-ink">
              {showArchived ? 'Hide archived' : 'Show archived'}
            </button>
          </div>
          {showArchived && archived.length > 0 && (
            <ul className="divide-y divide-line border-t border-line bg-sunken/40">
              {archived.map((h, i) => (
                <HabitRow key={h._id} h={h} index={i} total={1} onEdit={() => { setEditing(h); setFormOpen(true); }} onDelete={() => setDeleting(h)} onMove={() => {}} />
              ))}
            </ul>
          )}
          {showArchived && archived.length === 0 && <p className="px-5 pb-4 text-sm text-muted">No archived habits.</p>}
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold mb-1">Last 13 weeks</h2>
          <p className="text-sm text-muted mb-4">Share of scheduled habits completed each day.</p>
          {heat.isLoading ? <Skeleton className="h-32" /> : heat.data ? <Heatmap data={heat.data} /> : null}
        </section>
      </div>

      <HabitFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing} onSubmit={submit} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete “${deleting?.name}”?`}
        description="It disappears from your list and stats. Archive instead if you might bring it back."
        confirmLabel="Delete habit" loading={m.remove.isPending}
        onConfirm={async () => { if (deleting) await m.remove.mutateAsync(deleting._id); setDeleting(null); }} />
    </div>
  );
}
