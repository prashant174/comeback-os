import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, ClipboardCopy, Printer, RotateCcw } from 'lucide-react';
import { get } from '@/lib/resource';
import { useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { Panel, Stat } from '@/components/ui/kit';
import { addDays, fmtMinutes, prettyDate } from '@/lib/date';

type Report = { from: string; to: string; text: string; done: unknown[]; totalMinutes: number; blockers: unknown[]; receivedCount: number; delivered: unknown[]; hours: { name: string; minutes: number }[] };

export default function ReportTab() {
  const today = useToday();
  const [ref, setRef] = useState(today);
  useEffect(() => setRef(today), [today]);
  const q = useQuery({ queryKey: ['work-report', ref], queryFn: () => get<Report>('/work/report/weekly', { date: ref }) });
  const [text, setText] = useState('');
  useEffect(() => { if (q.data) setText(q.data.text); }, [q.data]);
  const r = q.data;
  const copy = () => navigator.clipboard.writeText(text).then(() => toast.success('Copied — paste into WhatsApp or email'), () => toast.error('Clipboard not available'));
  const print = () => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return toast.error('Allow pop-ups to print / save as PDF');
    const pre = w.document.createElement('pre');
    pre.textContent = text; // textContent: no HTML injection from task titles
    pre.style.cssText = 'font: 14px/1.6 ui-sans-serif, system-ui, sans-serif; white-space: pre-wrap; margin: 32px;';
    w.document.title = `Weekly status ${r?.from} to ${r?.to}`;
    w.document.body.appendChild(pre);
    w.focus(); w.print();
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 panel rounded-xl p-1">
          <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setRef(addDays(r?.from ?? ref, -7))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-2 min-w-[170px] text-center">{r ? `${prettyDate(r.from, { day: 'numeric', month: 'short' })} – ${prettyDate(r.to, { day: 'numeric', month: 'short' })}` : '…'}</span>
          <Button variant="ghost" size="icon" aria-label="Next week" disabled={!!r && r.to >= today} onClick={() => setRef(addDays(r?.from ?? ref, 7))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4" />PDF</Button>
          <Button onClick={copy}><ClipboardCopy className="h-4 w-4" />Copy report</Button>
        </div>
      </div>
      {q.isLoading || !r ? <Skeleton className="h-96" /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Tasks completed" value={r.done.length} />
            <Stat label="Time logged" value={fmtMinutes(r.totalMinutes)} sub={r.hours[0] ? `most on ${r.hours[0].name}` : undefined} />
            <Stat label="Requirements" value={`${r.delivered.length} delivered`} sub={`${r.receivedCount} received`} />
            <Stat label="Blockers" value={r.blockers.length} />
          </div>
          <Panel title="Report" action={text !== r.text ? <Button size="sm" variant="ghost" onClick={() => setText(r.text)}><RotateCcw className="h-3.5 w-3.5" />Reset</Button> : undefined}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={22} aria-label="Weekly report text"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed font-mono focus-visible:ring-2 focus-visible:ring-leaf" />
            <p className="hint mt-2">Generated from your tasks, requirements, change log and work log. Edit freely before sending — edits aren't saved.</p>
          </Panel>
        </>
      )}
    </div>
  );
}
