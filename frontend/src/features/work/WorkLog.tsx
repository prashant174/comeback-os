import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Clock, Trash2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { get } from '@/lib/resource';
import { useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { DateNav, Panel, dateTitle } from '@/components/ui/kit';
import { fmtMinutes } from '@/lib/date';
import type { WorkLogEntry } from '@/types';
import { projectNameOf, projectOptions, useProjects, useWorkInvalidate } from './shared';

type Day = { date: string; logs: WorkLogEntry[]; doneTasks: { _id: string; title: string; project: { name: string } | null }[]; totalMinutes: number };

export default function WorkLog() {
  const today = useToday();
  const [date, setDate] = useState(today);
  useEffect(() => setDate(today), [today]);
  const projects = useProjects();
  const invalidate = useWorkInvalidate();
  const q = useQuery({ queryKey: ['work-day', date], queryFn: () => get<Day>('/work/logs/day', { date }) });
  const [project, setProject] = useState('');
  const [desc, setDesc] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [custom, setCustom] = useState('');
  const add = useMutation({
    mutationFn: () => api.post('/work/logs', { date, project: project || null, description: desc.trim(), minutes: custom ? Number(custom) : minutes }),
    onSuccess: () => { invalidate(); setDesc(''); setCustom(''); toast.success('Logged'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/work/logs/${id}`), onSuccess: invalidate });
  const d = q.data;
  const submit = () => {
    if (!desc.trim()) return toast.error('What did you work on?');
    const m = custom ? Number(custom) : minutes;
    if (!(m >= 1 && m <= 1440)) return toast.error('Minutes must be between 1 and 1440');
    add.mutate();
  };
  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <DateNav date={date} onChange={setDate} max={today} />
          <p className="text-sm"><span className="text-muted">{dateTitle(date, today)} · </span><span className="font-display text-xl font-semibold num">{fmtMinutes(d?.totalMinutes ?? 0)}</span></p>
        </div>
        <Panel title="Log time">
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="grid sm:grid-cols-[200px_1fr] gap-2">
              <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">{projectOptions(projects.data?.items).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={500} placeholder="What did you work on?" aria-label="Description" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[15, 30, 60, 120].map((m) => (
                <button type="button" key={m} aria-pressed={!custom && minutes === m} onClick={() => { setMinutes(m); setCustom(''); }}
                  className={`h-9 px-3 rounded-xl text-sm border ${!custom && minutes === m ? 'bg-leaf-soft text-leaf-ink border-leaf/40 font-medium' : 'border-line text-muted hover:bg-sunken'}`}>{fmtMinutes(m)}</button>
              ))}
              <Input type="number" min={1} max={1440} placeholder="min" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-24 h-9" aria-label="Custom minutes" />
              <Button type="submit" className="ml-auto" loading={add.isPending}>Add</Button>
            </div>
          </form>
        </Panel>
        <Panel title="Entries" bodyClass="px-0">
          {q.isLoading ? <div className="px-5"><Skeleton className="h-24" /></div> : !d?.logs.length ? (
            <EmptyState icon={<Clock className="h-6 w-6" />} title="Nothing logged" body="A quick line per chunk of work makes the weekly report write itself." />
          ) : (
            <ul className="divide-y divide-line">
              {d.logs.map((l) => (
                <li key={l._id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="w-14 font-semibold num text-sm">{fmtMinutes(l.minutes)}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm truncate">{l.description}</p><p className="text-xs text-muted">{projectNameOf(l.project, projects.data?.items) ?? 'No project'}</p></div>
                  <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => del.mutate(l._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title={`Finished ${date === today ? 'today' : 'that day'}`}>
        {!d?.doneTasks.length ? <p className="text-sm text-muted">Tasks you mark done show up here automatically.</p> : (
          <ul className="space-y-2">{d.doneTasks.map((t) => <li key={t._id} className="flex gap-2 text-sm"><Check className="h-4 w-4 text-leaf shrink-0 mt-0.5" /><span>{t.title}{t.project ? <span className="text-muted"> · {t.project.name}</span> : null}</span></li>)}</ul>
        )}
      </Panel>
    </div>
  );
}
