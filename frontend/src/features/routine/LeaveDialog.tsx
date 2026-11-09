import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { useList } from '@/hooks/useResource';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Routine } from '@/types';

export const DAY_TYPE_LABEL: Record<string, string> = { leave: 'Leave', holiday: 'Holiday', sick: 'Sick day', wfh: 'Work from home', travel: 'Travel', other: 'Other' };

/** Marks one or more days as leave/holiday; the chosen routine replaces the weekday one. */
export function LeaveDialog({ open, onOpenChange, date }: { open: boolean; onOpenChange: (o: boolean) => void; date: string }) {
  const qc = useQueryClient();
  const routines = useList<Routine>('/routines');
  const leaveRoutine = routines.data?.items.find((r) => r.name === 'Leave day') ?? routines.data?.items.find((r) => r.days.length === 0);
  const [v, setV] = useState({ from: date, to: date, type: 'leave', routine: '', note: '' });
  useEffect(() => { if (open) setV({ from: date, to: date, type: 'leave', routine: leaveRoutine?._id ?? '', note: '' }); }, [open, date, leaveRoutine?._id]);
  const save = useMutation({
    mutationFn: () => api.post('/routines/overrides', { ...v, routine: v.routine || null }).then((r) => r.data.data.dates as string[]),
    onSuccess: (dates) => {
      ['routine-day', 'routine-overrides', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(dates.length > 1 ? `${dates.length} days marked as ${DAY_TYPE_LABEL[v.type].toLowerCase()}` : `Marked as ${DAY_TYPE_LABEL[v.type].toLowerCase()}`);
      onOpenChange(false);
    },
    onError: (e) => toast.error(apiError(e)),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Mark leave / holiday" description="Those days follow the routine you pick instead of the usual weekday one. Wake-up and workout alarms stay quiet.">
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="From" htmlFor="lv-from"><Input id="lv-from" type="date" value={v.from} onChange={(e) => setV({ ...v, from: e.target.value, to: e.target.value > v.to ? e.target.value : v.to })} required /></Field>
        <Field label="To" htmlFor="lv-to"><Input id="lv-to" type="date" min={v.from} value={v.to} onChange={(e) => setV({ ...v, to: e.target.value })} required /></Field>
        <Field label="Type" htmlFor="lv-type"><Select id="lv-type" value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>{Object.entries(DAY_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Routine for these days" htmlFor="lv-routine">
          <Select id="lv-routine" value={v.routine} onChange={(e) => setV({ ...v, routine: e.target.value })}>
            <option value="">No routine (free day)</option>
            {routines.data?.items.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Note (optional)" htmlFor="lv-note" className="col-span-2"><Input id="lv-note" value={v.note} maxLength={200} placeholder="Family function, festival, trip…" onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
        <div className="col-span-2 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" loading={save.isPending}>Mark days</Button></div>
      </form>
    </Dialog>
  );
}
