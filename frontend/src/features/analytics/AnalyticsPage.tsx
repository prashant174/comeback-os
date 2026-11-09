import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { get, download } from '@/lib/resource';
import { apiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Panel, Progress, Segmented, Stat, axisTick, chartTooltip } from '@/components/ui/kit';
import { prettyDate, shortDay } from '@/lib/date';
import { formatINR, formatMl } from '@/lib/utils';

type A = {
  from: string; to: string;
  targets: { proteinMinG: number; waterMl: number; sleepHours: number; studyMinutesPerDay: number } | null;
  kpis: Record<string, number | null>;
  series: { date: string; habitPct: number; waterMl: number; protein: number; kcal: number; sleepHours: number | null; studyMin: number; workouts: number; workoutMin: number; spent: number; mood: number | null }[];
  expensesByCategory: { category: string; total: number }[];
  weight: { date: string; weightKg: number }[];
  goals: { _id: string; title: string; status: string; progress: number; deadline: string }[];
};
const EXPORTS = [['expenses', 'Expenses'], ['meals', 'Meals'], ['workouts', 'Workouts'], ['measurements', 'Body measurements'], ['sleep', 'Sleep'], ['study', 'Study sessions'], ['water', 'Water'], ['habits', 'Habit completions'], ['journal', 'Journal']] as const;

function Chart({ title, children, className }: { title: string; children: React.ReactElement; className?: string }) {
  return <Panel title={title} className={className}><div className="h-52 -ml-2 print:h-44"><ResponsiveContainer>{children}</ResponsiveContainer></div></Panel>;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [exp, setExp] = useState<string>('expenses');
  const q = useQuery({ queryKey: ['analytics', days], queryFn: () => get<A>('/analytics', { days }) });
  const tick = (d: string) => (days <= 7 ? shortDay(d) : prettyDate(d, { day: 'numeric', month: 'short' }));
  const label = (d: unknown) => prettyDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' });
  const grid = <CartesianGrid vertical={false} stroke="hsl(var(--line))" />;
  const x = <XAxis dataKey="date" tickFormatter={tick} tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />;

  if (q.isError) return <ErrorState message={apiError(q.error)} onRetry={() => q.refetch()} />;
  const a = q.data, k = a?.kpis ?? {};
  return (
    <div className="print:text-black">
      <PageHeader title={days === 90 ? '90-day transformation report' : 'Analytics'} subtitle={a ? `${prettyDate(a.from, { day: 'numeric', month: 'short' })} – ${prettyDate(a.to, { day: 'numeric', month: 'short', year: 'numeric' })}${user ? ` · ${user.name}` : ''}` : ' '}
        actions={<div className="print:hidden flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" />Save as PDF</Button></div>} />
      <div className="flex flex-wrap items-center gap-3 mb-5 print:hidden">
        <Segmented label="Range" value={days} onChange={setDays} options={[{ v: 7, label: 'Week' }, { v: 30, label: 'Month' }, { v: 90, label: '90 days' }]} />
        <div className="flex gap-2 ml-auto">
          <Select value={exp} onChange={(e) => setExp(e.target.value)} className="w-48" aria-label="Data to export">{EXPORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Button variant="outline" onClick={() => download('/analytics/export', { module: exp, from: a?.from, to: a?.to }, `comeback-${exp}.csv`).catch((e) => toast.error(apiError(e)))}><Download className="h-4 w-4" />Export CSV</Button>
        </div>
      </div>
      {q.isLoading || !a ? <Skeleton className="h-96" /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Habit consistency" value={`${k.habitConsistency}%`} sub="avg daily completion" />
            <Stat label="Workouts" value={k.workouts} sub={`on ${k.workoutDays} of ${k.days} days`} />
            <Stat label="Study time" value={`${k.studyHours} h`} sub={`${(Number(k.studyHours) / Number(k.days) * 60).toFixed(0)} min/day avg`} />
            <Stat label="Weight change" value={k.weightChangeKg === null ? '—' : `${Number(k.weightChangeKg) > 0 ? '+' : ''}${k.weightChangeKg} kg`} sub="first → last weigh-in" />
            <Stat label="Avg protein" value={k.proteinDaysLogged ? `${k.avgProtein} g` : '—'} sub={`target hit ${k.proteinDaysOnTarget} days`} />
            <Stat label="Avg water" value={formatMl(Number(k.avgWaterMl))} sub={`target hit ${k.waterDaysOnTarget} days`} />
            <Stat label="Avg sleep" value={k.sleepNightsLogged ? `${k.avgSleepHours} h` : '—'} sub={`${k.sleepNightsLogged} nights logged${k.avgMood ? ` · mood ${k.avgMood}/5` : ''}`} />
            <Stat label="Spent" value={formatINR(Number(k.spent), 0)} sub={`across ${a.expensesByCategory.length} categories`} />
          </div>
          <div className="grid lg:grid-cols-2 gap-5 print:grid-cols-2">
            <Chart title="Habits & water">
              <ComposedChart data={a.series}>{grid}{x}<YAxis domain={[0, 100]} tick={axisTick} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number, n) => n === 'waterPct' ? [`${v}%`, 'Water vs target'] : [`${v}%`, 'Habits']} />
                <Bar dataKey="habitPct" fill="hsl(var(--leaf))" radius={[4, 4, 1, 1]} maxBarSize={18} />
                <Line dataKey={(d: A['series'][number]) => (a.targets?.waterMl ? Math.min(100, Math.round((d.waterMl / a.targets.waterMl) * 100)) : 0)} name="waterPct" stroke="hsl(var(--water))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </Chart>
            <Chart title="Protein (g)">
              <BarChart data={a.series}>{grid}{x}<YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number) => [`${v} g`, 'Protein']} />
                {a.targets?.proteinMinG ? <ReferenceLine y={a.targets.proteinMinG} stroke="hsl(var(--muted))" strokeDasharray="4 4" /> : null}
                <Bar dataKey="protein" fill="hsl(var(--leaf))" radius={[4, 4, 1, 1]} maxBarSize={18} /></BarChart>
            </Chart>
            <Chart title="Sleep (hours)">
              <BarChart data={a.series}>{grid}{x}<YAxis domain={[0, 10]} tick={axisTick} tickLine={false} axisLine={false} width={28} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number) => [`${v} h`, 'Sleep']} />
                {a.targets?.sleepHours ? <ReferenceLine y={a.targets.sleepHours} stroke="hsl(var(--muted))" strokeDasharray="4 4" /> : null}
                <Bar dataKey="sleepHours" fill="hsl(var(--water))" radius={[4, 4, 1, 1]} maxBarSize={18} /></BarChart>
            </Chart>
            <Chart title="Study & workouts (minutes)">
              <BarChart data={a.series}>{grid}{x}<YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number, n) => [`${v} min`, n === 'studyMin' ? 'Study' : 'Workout']} />
                <Bar dataKey="studyMin" stackId="t" fill="hsl(var(--leaf))" maxBarSize={18} /><Bar dataKey="workoutMin" stackId="t" fill="hsl(var(--amber))" radius={[4, 4, 0, 0]} maxBarSize={18} /></BarChart>
            </Chart>
            <Chart title="Daily spending">
              <BarChart data={a.series}>{grid}{x}<YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `₹${v}`} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number) => [formatINR(v, 2), 'Spent']} />
                <Bar dataKey="spent" fill="hsl(var(--leaf))" radius={[4, 4, 1, 1]} maxBarSize={18} /></BarChart>
            </Chart>
            <Chart title={a.weight.length >= 2 ? 'Weight (kg)' : 'Mood (1–5)'}>
              {a.weight.length >= 2 ? (
                <LineChart data={a.weight}>{grid}{x}<YAxis domain={[(m: number) => Math.floor(m - 1), (m: number) => Math.ceil(m + 1)]} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={32} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number) => [`${v} kg`, 'Weight']} />
                  <Line dataKey="weightKg" stroke="hsl(var(--leaf))" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart>
              ) : (
                <LineChart data={a.series}>{grid}{x}<YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={axisTick} tickLine={false} axisLine={false} width={24} /><Tooltip {...chartTooltip} labelFormatter={label} formatter={(v: number) => [v, 'Mood']} />
                  <Line dataKey="mood" stroke="hsl(var(--amber))" strokeWidth={2.5} connectNulls dot={{ r: 3 }} /></LineChart>
              )}
            </Chart>
          </div>
          <div className="grid lg:grid-cols-2 gap-5 print:grid-cols-2">
            <Panel title="Spending by category">
              {!a.expensesByCategory.length ? <p className="text-sm text-muted">No expenses in this period.</p> : (
                <ul className="space-y-3">{a.expensesByCategory.map((c) => (
                  <li key={c.category}><div className="flex justify-between text-sm mb-1"><span>{c.category}</span><span className="num">{formatINR(c.total, 2)}</span></div><Progress value={c.total} max={a.expensesByCategory[0].total} label={c.category} /></li>
                ))}</ul>
              )}
            </Panel>
            <Panel title={`Goals · ${k.goalsCompleted} completed, ${k.goalsActive} active`}>
              <ul className="space-y-3">{a.goals.filter((g) => g.status !== 'dropped').map((g) => (
                <li key={g._id}><div className="flex justify-between text-sm mb-1 gap-3"><span className="truncate">{g.title}</span><span className="num shrink-0">{g.progress}%</span></div><Progress value={g.progress} tone={g.status === 'completed' ? 'leaf' : 'water'} label={g.title} /></li>
              ))}</ul>
            </Panel>
          </div>
          <p className="text-xs text-muted">Nutrition totals use your food database; items marked as estimates are approximate. Sleep quality is self-rated.</p>
        </div>
      )}
    </div>
  );
}
