import { Link } from 'react-router-dom';
import { Check, Droplet, Dumbbell, Flame, Plus } from 'lucide-react';
import { Progress } from '@/components/ui/kit';
import { to12h, fmtMinutes } from '@/lib/date';
import { formatINR } from '@/lib/utils';
import type { ReactNode } from 'react';
import { useDashboard, useToggleHabit, useWaterMutations } from '@/hooks/queries';
import { useAuth } from '@/context/AuthContext';
import { DayRing, RingLegend } from './DayRing';
import { ScheduleTimeline } from './ScheduleTimeline';
import { WeeklyChart } from './WeeklyChart';
import { HabitIcon } from '@/components/HabitIcon';
import { ErrorState, Skeleton } from '@/components/ui/misc';
import { greetingFor, nowMinutesIn, prettyDate } from '@/lib/date';
import { apiError } from '@/lib/api';
import { cn, formatMl, pct } from '@/lib/utils';
import type { Dashboard } from '@/types';

const SPAN: Record<string, string> = { sm: 'lg:col-span-4', md: 'lg:col-span-6', lg: 'lg:col-span-12' };

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('panel p-5 sm:p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ScoreWidget({ d }: { d: Dashboard }) {
  return (
    <section className="panel p-5 sm:p-7 flex flex-col sm:flex-row items-center gap-6 sm:gap-8 rounded-3xl">
      <DayRing score={d.score} rings={d.scoreComponents} size={200} />
      <div className="flex-1 w-full">
        <h2 className="text-lg font-semibold mb-1">Today's score</h2>
        <p className="text-sm text-muted mb-5">Average of every area that applies today. Rest days skip workout; sleep counts once logged.</p>
        <RingLegend rings={d.scoreComponents} />
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-line text-sm">
          <Flame className="h-4 w-4 text-amber" />
          <span>Best active streak</span>
          <span className="ml-auto font-display font-semibold num">{d.habits.topStreak} {d.habits.topStreak === 1 ? 'day' : 'days'}</span>
        </div>
      </div>
    </section>
  );
}

function HabitsWidget({ d }: { d: Dashboard }) {
  const toggle = useToggleHabit();
  return (
    <Section title="Today's habits" action={<span className="text-sm text-muted num">{d.habits.done}/{d.habits.scheduled}</span>}>
      {d.habits.items.length === 0 ? (
        <p className="text-sm text-muted">Nothing scheduled today. <Link to="/habits" className="text-leaf hover:underline">Add a habit</Link></p>
      ) : (
        <ul className="-mx-2">
          {d.habits.items.map((h) => (
            <li key={h._id}>
              <button
                onClick={() => toggle.mutate({ id: h._id, completed: !h.completedToday })}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sunken text-left"
                aria-pressed={h.completedToday}>
                <span className={cn('h-6 w-6 rounded-lg border-2 grid place-items-center transition-colors shrink-0',
                  h.completedToday ? 'bg-leaf border-leaf text-white dark:text-[#06140D]' : 'border-line')}>
                  {h.completedToday && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <HabitIcon name={h.icon} className="h-4 w-4 text-muted shrink-0" />
                <span className={cn('flex-1 text-sm truncate', h.completedToday && 'text-muted line-through decoration-line')}>{h.name}</span>
                {h.streak > 0 && <span className="text-xs text-muted num flex items-center gap-1"><Flame className="h-3 w-3 text-amber" />{h.streak}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function WaterWidget({ d }: { d: Dashboard }) {
  const { add } = useWaterMutations();
  const p = pct(d.water.totalMl, d.water.targetMl);
  return (
    <Section title="Water" action={<Link to="/water" className="text-sm text-muted hover:text-ink">History</Link>}>
      <div className="flex items-end gap-2 mb-3">
        <span className="font-display text-3xl font-semibold num">{formatMl(d.water.totalMl)}</span>
        <span className="text-sm text-muted mb-1">of {formatMl(d.water.targetMl)}</span>
      </div>
      <div className="h-2.5 rounded-full bg-sunken overflow-hidden mb-4" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label="Water progress">
        <div className="h-full bg-water rounded-full transition-[width] duration-500" style={{ width: `${p}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {d.water.quickAdd.map((ml) => (
          <button key={ml} onClick={() => add.mutate(ml)}
            className="h-10 rounded-xl bg-water-soft text-water text-sm font-medium flex items-center justify-center gap-1 hover:brightness-95 dark:hover:brightness-125">
            <Plus className="h-3.5 w-3.5" />{ml}
          </button>
        ))}
      </div>
    </Section>
  );
}

function ProfileWidget({ d }: { d: Dashboard }) {
  const rows = [
    ['Weight', d.personal.currentWeightKg ? `${d.personal.currentWeightKg} kg` : '—'],
    ['Height', d.personal.heightCm ? `${d.personal.heightCm} cm` : '—'],
    ['Protein target', `${d.targets.proteinMinG}–${d.targets.proteinMaxG} g`],
    ['Sleep target', `${d.targets.sleepHours} h`],
    ['Study / day', `${d.targets.studyMinutesPerDay} min`],
  ];
  return (
    <Section title="Targets" action={<Link to="/settings" className="text-sm text-muted hover:text-ink">Edit</Link>}>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 text-sm first:pt-0 last:pb-0">
            <dt className="text-muted">{k}</dt><dd className="font-medium num">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}


function MiniStat({ title, to, children }: { title: string; to: string; children: ReactNode }) {
  return <Section title={title} action={<Link to={to} className="text-sm text-muted hover:text-ink">Open</Link>}>{children}</Section>;
}

function WorkoutWidget({ d }: { d: Dashboard }) {
  const w = d.workout;
  return (
    <MiniStat title="Workout" to="/fitness">
      <p className="font-display text-2xl font-semibold">{w.title ?? 'No plan'}</p>
      <p className="text-sm text-muted mt-1">{w.isRest ? 'Rest day' : `${w.focus[0].toUpperCase()}${w.focus.slice(1)} · ${w.exercises} exercises`}</p>
      <div className="mt-4">
        {w.done ? <span className="inline-flex items-center gap-1.5 text-sm text-leaf font-medium"><Check className="h-4 w-4" />Done{w.minutes ? ` · ${w.minutes} min` : ''}</span>
          : w.isRest ? <span className="text-sm text-muted">Recover well.</span>
          : <Link to="/fitness" className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-leaf text-white dark:text-[#06140D] text-sm font-medium"><Dumbbell className="h-4 w-4" />Start workout</Link>}
      </div>
    </MiniStat>
  );
}

function NutritionWidget({ d }: { d: Dashboard }) {
  const n = d.nutrition;
  return (
    <MiniStat title="Protein" to="/nutrition">
      <div className="flex items-end gap-2"><span className="font-display text-3xl font-semibold num">{n.protein}</span><span className="text-sm text-muted mb-1">/ {n.proteinMinG}–{n.proteinMaxG} g</span></div>
      <Progress value={n.protein} max={n.proteinMinG || 1} className="mt-3 h-2.5" label="Protein" />
      <p className="text-xs text-muted mt-3 num">{n.kcal} kcal · {n.carbs} g carbs · {n.fat} g fat{n.hasEstimates ? ' · estimated' : ''}</p>
    </MiniStat>
  );
}

function StudyWidget({ d }: { d: Dashboard }) {
  return (
    <MiniStat title="Study" to="/learning">
      <div className="flex items-end gap-2"><span className="font-display text-3xl font-semibold num">{fmtMinutes(d.study.minutes)}</span><span className="text-sm text-muted mb-1">of {fmtMinutes(d.study.targetMinutes)}</span></div>
      <Progress value={d.study.minutes} max={d.study.targetMinutes || 1} className="mt-3 h-2.5" label="Study" />
    </MiniStat>
  );
}

function SleepWidget({ d }: { d: Dashboard }) {
  const s = d.sleep;
  return (
    <MiniStat title="Last night" to="/sleep">
      {s.hours === null ? <><p className="text-sm text-muted">Not logged yet.</p><Link to="/sleep" className="text-sm text-leaf hover:underline mt-2 inline-block">Log sleep</Link></> : (
        <>
          <div className="flex items-end gap-2"><span className="font-display text-3xl font-semibold num">{s.hours} h</span><span className="text-sm text-muted mb-1">target {s.targetHours} h</span></div>
          <p className="text-xs text-muted mt-2 num">{to12h(s.bedtime!)} → {to12h(s.wakeTime!)} · rested {s.quality}/5</p>
        </>
      )}
    </MiniStat>
  );
}

function FinanceWidget({ d }: { d: Dashboard }) {
  const f = d.finance;
  return (
    <MiniStat title="Spending" to="/finance">
      <div className="flex items-end gap-2"><span className="font-display text-2xl font-semibold num">{formatINR(f.monthSpent)}</span><span className="text-sm text-muted mb-0.5">/ {formatINR(f.monthLimit)}</span></div>
      <Progress value={f.monthSpent} max={f.monthLimit || 1} tone={f.pct >= 100 ? 'danger' : f.pct >= 90 ? 'amber' : 'leaf'} className="mt-3 h-2.5" label="Monthly budget" />
      <p className="text-xs text-muted mt-2">Today {formatINR(f.spentToday, 2)}</p>
    </MiniStat>
  );
}

function GoalsWidget({ d }: { d: Dashboard }) {
  return (
    <MiniStat title={`Goals · ${d.goals.active} active`} to="/goals">
      {!d.goals.top.length ? <p className="text-sm text-muted">No active goals.</p> : (
        <ul className="space-y-3">{d.goals.top.map((g) => (
          <li key={g._id}><div className="flex justify-between text-sm gap-2 mb-1"><span className="truncate">{g.title}</span><span className="num text-muted">{g.progress}%</span></div><Progress value={g.progress} label={g.title} /></li>
        ))}</ul>
      )}
    </MiniStat>
  );
}

function RoutineWidget({ d }: { d: Dashboard }) {
  const r = d.routine;
  if (!r.name) return <Section title="Today's plan"><ScheduleTimeline schedule={d.schedule} timezone={d.timezone} /></Section>;
  const STATUS: Record<string, string> = { done: 'bg-leaf border-leaf', missed: 'bg-danger/70 border-danger/70', skipped: 'bg-muted/40 border-muted/40' };
  return (
    <Section title={`Today · ${r.name}`} action={<Link to="/routine" className="text-sm text-muted hover:text-ink num">{r.stats.done}/{r.stats.total}</Link>}>
      <ol className="space-y-2.5">
        {r.activities.map((a) => (
          <li key={a._id} className="flex items-center gap-3">
            <span className={cn('h-2.5 w-2.5 rounded-full border-2 shrink-0', a.status ? STATUS[a.status] : a.isNow ? 'border-leaf ring-4 ring-leaf/20' : 'border-line')} />
            <span className={cn('flex-1 text-sm truncate', a.status === 'done' && 'text-muted line-through', a.isNow && 'font-semibold')}>{a.title}{a.isNow && <span className="ml-2 text-[11px] text-leaf font-medium">now</span>}</span>
            <span className="text-xs text-muted num">{to12h(a.start)}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const q = useDashboard();

  if (q.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-72" />
        <div className="grid lg:grid-cols-12 gap-5">
          <Skeleton className="h-72 lg:col-span-6 rounded-3xl" /><Skeleton className="h-72 lg:col-span-6" />
          <Skeleton className="h-56 lg:col-span-4" /><Skeleton className="h-56 lg:col-span-4" /><Skeleton className="h-56 lg:col-span-4" />
        </div>
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorState message={apiError(q.error, 'Could not load dashboard')} onRetry={() => q.refetch()} />;

  const d = q.data;
  const first = user?.name.split(' ')[0];
  const widgets: Record<string, ReactNode> = {
    score: <ScoreWidget d={d} />,
    habits: <HabitsWidget d={d} />,
    water: <WaterWidget d={d} />,
    schedule: <RoutineWidget d={d} />,
    workout: <WorkoutWidget d={d} />,
    nutrition: <NutritionWidget d={d} />,
    study: <StudyWidget d={d} />,
    sleep: <SleepWidget d={d} />,
    finance: <FinanceWidget d={d} />,
    goals: <GoalsWidget d={d} />,
    weekly: (
      <Section title="Last 7 days" action={
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-leaf" />Habits</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-water" />Water</span>
        </div>}>
        <WeeklyChart data={d.weekly} waterTarget={d.water.targetMl} />
      </Section>
    ),
    profile: <ProfileWidget d={d} />,
  };

  const visible = d.widgets.filter((w) => w.visible && widgets[w.key]);

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <p className="text-sm text-muted">{prettyDate(d.today)}</p>
        <h1 className="text-2xl sm:text-[32px] font-semibold mt-0.5">{greetingFor(nowMinutesIn(d.timezone))}, {first}</h1>
      </div>
      {visible.length === 0 ? (
        <div className="panel p-10 text-center">
          <Droplet className="h-6 w-6 mx-auto text-muted mb-3" />
          <p className="text-sm text-muted">All widgets are hidden. <Link to="/settings?tab=dashboard" className="text-leaf hover:underline">Choose widgets</Link></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
          {visible.map((w) => <div key={w.key} className={SPAN[w.size]}>{widgets[w.key]}</div>)}
        </div>
      )}
    </div>
  );
}
