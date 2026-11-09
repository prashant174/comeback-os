import { ensureUserDocs } from './userSetup.service.js';
import { dailyCompletion, listHabitsWithStatus } from './habit.service.js';
import { waterForDay, waterHistory } from './water.service.js';
import { nutritionDay } from './nutrition.service.js';
import { routineForDay } from './routine.service.js';
import { financeSummary } from './finance.service.js';
import { WorkoutLogModel, WorkoutPlanModel } from '../models/fitness.js';
import { StudySessionModel } from '../models/learning.js';
import { SleepRecordModel, GoalModel } from '../models/wellbeing.js';
import { ExpenseModel } from '../models/finance.js';
import { dayKey, lastNDays, weekdayOf } from '../utils/date.js';
import { round1 } from '../utils/timeCore.js';

/**
 * Dashboard summary. The daily score averages only components that apply
 * today and have a target: e.g. workout is skipped on a rest day and sleep is
 * skipped until last night is logged. `scoreComponents` lists exactly what
 * went into it.
 */
export async function getDashboard(userId: string) {
  const { profile, prefs } = await ensureUserDocs(userId);
  const tz = profile.personal?.timezone || 'Asia/Kolkata';
  const today = dayKey(new Date(), tz);
  const week = lastNDays(today, 7);
  const t = profile.targets!;

  const [habits, water, weekHabits, weekWater, nutrition, routine, plan, workoutLogs, studyToday, sleep, goals, finance, spentToday] = await Promise.all([
    listHabitsWithStatus(userId, today),
    waterForDay(userId, today),
    dailyCompletion(userId, week),
    waterHistory(userId, week),
    nutritionDay(userId, today),
    routineForDay(userId, today),
    WorkoutPlanModel.findOne({ user: userId, dayOfWeek: weekdayOf(today) }).lean(),
    WorkoutLogModel.find({ user: userId, date: today }).select('title durationMin completed').lean(),
    StudySessionModel.find({ user: userId, date: today }).select('minutes').lean(),
    SleepRecordModel.findOne({ user: userId, date: today }).lean(),
    GoalModel.find({ user: userId, status: 'active' }).sort({ deadline: 1 }).select('title progress deadline category').lean(),
    financeSummary(userId, today.slice(0, 7)),
    ExpenseModel.find({ user: userId, date: today }).select('amount').lean(),
  ]);

  const scheduled = habits.filter((h) => h.scheduledToday);
  const doneCount = scheduled.filter((h) => h.completedToday).length;
  const studyMin = studyToday.reduce((s, x) => s + x.minutes, 0);
  const isRest = !plan || plan.focus === 'rest' || plan.items.length === 0;
  const workoutDone = workoutLogs.some((l) => l.completed);
  const sleepHours = sleep ? round1(sleep.durationMin / 60) : null;
  const ratio = (v: number, target: number) => Math.min(1, v / target);

  const candidates: { key: string; label: string; ratio: number | null }[] = [
    { key: 'habits', label: 'Habits', ratio: scheduled.length ? doneCount / scheduled.length : null },
    { key: 'water', label: 'Water', ratio: t.waterMl > 0 ? ratio(water.totalMl, t.waterMl) : null },
    { key: 'protein', label: 'Protein', ratio: t.proteinMinG > 0 ? ratio(nutrition.totals.protein, t.proteinMinG) : null },
    { key: 'workout', label: 'Workout', ratio: isRest ? null : workoutDone ? 1 : 0 },
    { key: 'study', label: 'Study', ratio: t.studyMinutesPerDay > 0 ? ratio(studyMin, t.studyMinutesPerDay) : null },
    { key: 'sleep', label: 'Sleep', ratio: sleepHours !== null && t.sleepHours > 0 ? ratio(sleepHours, t.sleepHours) : null },
  ];
  const components = candidates.filter((c): c is { key: string; label: string; ratio: number } => c.ratio !== null);
  const score = components.length ? Math.round((components.reduce((s, c) => s + c.ratio, 0) / components.length) * 100) : 0;

  return {
    today, timezone: tz, score, scoreComponents: components,
    habits: {
      done: doneCount, scheduled: scheduled.length,
      items: scheduled.map((h) => ({ _id: h._id, name: h.name, icon: h.icon, category: h.category, completedToday: h.completedToday, streak: h.streak.current })),
      topStreak: habits.reduce((m, h) => Math.max(m, h.streak.current), 0),
    },
    water: { totalMl: water.totalMl, targetMl: t.waterMl, quickAdd: prefs.waterQuickAdd },
    schedule: profile.schedule,
    routine: { name: routine.routine?.name ?? null, activities: routine.activities.map((a) => ({ _id: a._id, title: a.title, start: a.start, end: a.end, status: a.status, isNow: a.isNow })), stats: routine.stats },
    workout: { title: plan?.title ?? null, focus: plan?.focus ?? 'rest', exercises: plan?.items.length ?? 0, isRest, done: workoutDone, minutes: workoutLogs.reduce((s, l) => s + l.durationMin, 0) },
    nutrition: { ...nutrition.totals, proteinMinG: t.proteinMinG, proteinMaxG: t.proteinMaxG, hasEstimates: nutrition.hasEstimates },
    study: { minutes: studyMin, targetMinutes: t.studyMinutesPerDay },
    sleep: { hours: sleepHours, quality: sleep?.quality ?? null, bedtime: sleep?.bedtime ?? null, wakeTime: sleep?.wakeTime ?? null, targetHours: t.sleepHours },
    finance: { spentToday: Math.round(spentToday.reduce((s, e) => s + e.amount, 0) * 100) / 100, monthSpent: finance.spent, monthLimit: finance.totalLimit, pct: finance.pct },
    goals: { active: goals.length, top: goals.slice(0, 3).map((g) => ({ _id: g._id, title: g.title, progress: g.progress, deadline: g.deadline })) },
    targets: t,
    personal: profile.personal,
    weekly: week.map((date, i) => ({ date, habitPct: Math.round(weekHabits[i].ratio * 100), waterMl: weekWater[i].totalMl })),
    widgets: prefs.dashboardWidgets,
  };
}
