import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2, Wallet } from 'lucide-react';
import { apiError } from '@/lib/api';
import { get, post, put } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, Panel, Progress, axisTick, chartTooltip } from '@/components/ui/kit';
import { addMonths, monthLabel, prettyDate } from '@/lib/date';
import { formatINR } from '@/lib/utils';
import type { Expense, FinanceSummary } from '@/types';

type Budget = { categories: { name: string; limit: number }[]; alertAtPct: number };

function BudgetEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const b = useQuery({ queryKey: ['budget'], queryFn: () => get<Budget>('/finance/budget'), enabled: open });
  const [cats, setCats] = useState<{ name: string; limit: number }[]>([]);
  const [alertAt, setAlertAt] = useState(90);
  useEffect(() => { if (b.data) { setCats(b.data.categories.map((c) => ({ ...c }))); setAlertAt(b.data.alertAtPct); } }, [b.data]);
  const save = useMutation({
    mutationFn: () => put('/finance/budget', { categories: cats.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), limit: Number(c.limit) || 0 })), alertAtPct: alertAt }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['budget'] }); qc.invalidateQueries({ queryKey: ['finance-summary'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.success('Budget saved'); onOpenChange(false); },
    onError: (e) => toast.error(apiError(e)),
  });
  const total = cats.reduce((s, c) => s + (Number(c.limit) || 0), 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Monthly budget" description="Applies to every month. Alerts fire when a category crosses the threshold.">
      <div className="space-y-3">
        {cats.map((c, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_36px] gap-2">
            <Input value={c.name} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label="Category name" maxLength={40} />
            <Input type="number" min={0} value={c.limit} onChange={(e) => setCats(cats.map((x, j) => j === i ? { ...x, limit: Number(e.target.value) } : x))} aria-label={`${c.name} limit`} />
            <Button variant="ghost" size="icon" aria-label={`Remove ${c.name}`} onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => setCats([...cats, { name: '', limit: 0 }])}><Plus className="h-4 w-4" />Add category</Button>
        <div className="flex items-center justify-between pt-3 border-t border-line text-sm">
          <label className="flex items-center gap-2">Alert at <Input type="number" min={50} max={100} value={alertAt} onChange={(e) => setAlertAt(Number(e.target.value))} className="w-20 h-8" aria-label="Alert percentage" />%</label>
          <span className="font-semibold num">Total {formatINR(total)}</span>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save budget</Button></div>
      </div>
    </Dialog>
  );
}

export default function FinancePage() {
  const today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  useEffect(() => setMonth(today.slice(0, 7)), [today]);
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ['finance-summary', month], queryFn: () => get<FinanceSummary>('/finance/summary', { month }) });
  const [cat, setCat] = useState('');
  const [yy, mm] = month.split('-').map(Number);
  const from = `${month}-01`, to = `${month}-${String(new Date(Date.UTC(yy, mm, 0)).getUTCDate()).padStart(2, '0')}`;
  const list = useList<Expense>('/finance/expenses', { from, to, limit: 500, category: cat || undefined });
  const m = useResourceMutations<Expense>('/finance/expenses', { noun: 'Expense', invalidate: [['finance-summary'], ['notifications']] });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [del, setDel] = useState<Expense | null>(null);
  const recurring = useMutation({
    mutationFn: () => post<Expense[]>('/finance/recurring/apply', { month }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['/finance/expenses'] }); qc.invalidateQueries({ queryKey: ['finance-summary'] }); toast.success(r.length ? `Added ${r.length} recurring expenses` : 'Nothing new to copy from last month'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const categories = s.data?.categories.map((c) => c.name) ?? [];
  const fields: FieldDef[] = [
    { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, min: 0.01, max: 10000000, step: '0.01' },
    { name: 'date', label: 'Date', type: 'date', required: true },
    { name: 'category', label: 'Category', type: 'select', options: (categories.length ? categories : ['Miscellaneous']).map((c) => ({ value: c, label: c })) },
    { name: 'note', label: 'Note', type: 'text', max: 200, placeholder: 'What was it?' },
    { name: 'recurring', label: 'Repeats every month', type: 'checkbox', full: true },
  ];
  const d = s.data;
  const tone = (pct: number | null) => (pct === null ? 'leaf' : pct >= 100 ? 'danger' : pct >= (d?.alertAtPct ?? 90) ? 'amber' : 'leaf');

  return (
    <div>
      <PageHeader title="Finance" subtitle="Your self-improvement budget, month by month."
        actions={<><Button variant="outline" onClick={() => setBudgetOpen(true)}>Edit budget</Button><Button onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />Add expense</Button></>} />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex items-center gap-1 panel rounded-xl p-1">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium px-2 min-w-[130px] text-center">{monthLabel(month)}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="ghost" size="sm" onClick={() => recurring.mutate()} loading={recurring.isPending}><Repeat className="h-4 w-4" />Copy last month’s recurring</Button>
      </div>

      {s.isLoading || !d ? <Skeleton className="h-48" /> : (
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-5 mb-5">
          <section className="panel p-5 sm:p-6 rounded-3xl">
            <p className="text-sm text-muted">Spent this month</p>
            <p className="font-display text-4xl font-semibold num mt-1">{formatINR(d.spent, 2)}<span className="text-lg text-muted"> / {formatINR(d.totalLimit)}</span></p>
            <Progress value={d.spent} max={d.totalLimit || 1} tone={tone(d.pct)} className="mt-3 h-3" label="Monthly budget used" />
            <p className="text-sm mt-2">{d.remaining >= 0 ? <span className="text-muted">{formatINR(d.remaining, 2)} left</span> : <span className="text-danger">Over by {formatINR(-d.remaining, 2)}</span>}</p>
            <ul className="mt-6 space-y-3.5">
              {d.categories.map((c) => (
                <li key={c.name}>
                  <div className="flex justify-between text-sm mb-1"><span>{c.name}</span><span className="num text-muted">{formatINR(c.spent, 2)}{c.limit ? ` / ${formatINR(c.limit)}` : ''}</span></div>
                  <Progress value={c.spent} max={c.limit || c.spent || 1} tone={tone(c.pct)} label={`${c.name} budget`} />
                </li>
              ))}
            </ul>
          </section>
          <div className="space-y-5">
            <Panel title="Daily spending">
              <div className="h-44 -ml-2"><ResponsiveContainer><BarChart data={d.daily}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
                <XAxis dataKey="date" tickFormatter={(x) => String(Number(x.slice(8)))} interval={4} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `₹${v}`} />
                <Tooltip {...chartTooltip} labelFormatter={(x) => prettyDate(String(x), { day: 'numeric', month: 'short' })} formatter={(v: number) => [formatINR(v, 2), 'Spent']} />
                <Bar dataKey="total" fill="hsl(var(--leaf))" radius={[4, 4, 1, 1]} maxBarSize={14} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Savings vs budget">
              {!d.history.length ? <p className="text-sm text-muted">Appears once you log expenses.</p> : (
                <ul className="divide-y divide-line -mx-5">
                  {d.history.map((h) => (
                    <li key={h.month} className="flex justify-between px-5 py-2 text-sm">
                      <span>{monthLabel(h.month)}</span>
                      <span className="num">{formatINR(h.spent, 2)} <span className={h.saved >= 0 ? 'text-leaf' : 'text-danger'}>({h.saved >= 0 ? 'saved ' : 'over '}{formatINR(Math.abs(h.saved), 2)})</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}

      <Panel title="Expenses" action={
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-44 h-8" aria-label="Filter category">
          <option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>}>
        {list.isLoading ? <Skeleton className="h-32" /> : !list.data?.items.length ? (
          <EmptyState icon={<Wallet className="h-6 w-6" />} title="No expenses this month" body="Log what you spend on fitness, food, clothes and grooming to see where it goes." />
        ) : (
          <ul className="divide-y divide-line -mx-5">
            {list.data.items.map((e) => (
              <li key={e._id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="w-14 text-xs text-muted">{prettyDate(e.date, { day: 'numeric', month: 'short' })}</div>
                <div className="flex-1 min-w-0"><p className="text-sm truncate">{e.note || e.category}</p><div className="flex gap-1.5 mt-0.5"><Chip>{e.category}</Chip>{e.recurring && <Chip tone="water"><Repeat className="h-3 w-3" />monthly</Chip>}</div></div>
                <span className="font-semibold num text-sm">{formatINR(e.amount, 2)}</span>
                <Button variant="ghost" size="icon" aria-label="Edit expense" onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4 text-muted" /></Button>
                <Button variant="ghost" size="icon" aria-label="Delete expense" onClick={() => setDel(e)}><Trash2 className="h-4 w-4 text-muted" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit expense' : 'Add expense'} fields={fields} submitLabel={edit ? 'Save expense' : 'Add expense'}
        initial={edit ?? { date: month === today.slice(0, 7) ? today : `${month}-01`, category: categories[0] }}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit._id, body: v }) : m.create.mutateAsync(v)} />
      <BudgetEditor open={budgetOpen} onOpenChange={setBudgetOpen} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Delete this expense?" description={del ? `${formatINR(del.amount, 2)} · ${del.category}` : ''}
        confirmLabel="Delete expense" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}
