import { Types } from 'mongoose';
import { HabitModel } from '../models/Habit.js';
import { HabitLogModel } from '../models/HabitLog.js';
import { lastNDays, shiftDay, weekdayOf } from '../utils/date.js';

type HabitLike = { _id: Types.ObjectId; frequency: string; daysOfWeek: number[]; createdAt?: Date };

export const isScheduledOn = (h: Pick<HabitLike, 'frequency' | 'daysOfWeek'>, day: string) =>
  h.frequency === 'daily' || h.daysOfWeek.includes(weekdayOf(day));

/**
 * Current streak = consecutive scheduled days completed, walking back from today.
 * If today is scheduled but not done yet, the streak is counted from yesterday
 * (the day isn't over, so it shouldn't break the streak).
 */
export function computeStreaks(h: HabitLike, doneDays: Set<string>, today: string) {
  let current = 0;
  let cursor = today;
  if (isScheduledOn(h, today) && !doneDays.has(today)) cursor = shiftDay(today, -1);
  for (let i = 0; i < 400; i++) {
    if (isScheduledOn(h, cursor)) {
      if (doneDays.has(cursor)) current++;
      else break;
    }
    cursor = shiftDay(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const sorted = [...doneDays].sort();
  if (sorted.length) {
    let d = sorted[0];
    while (d <= today) {
      if (isScheduledOn(h, d)) {
        if (doneDays.has(d)) { run++; best = Math.max(best, run); } else run = 0;
      }
      d = shiftDay(d, 1);
    }
  }
  return { current, best: Math.max(best, current) };
}

export async function listHabitsWithStatus(userId: string, today: string, includeArchived = false) {
  const filter: Record<string, unknown> = { user: userId, deletedAt: null };
  if (!includeArchived) filter.archived = false;
  const habits = await HabitModel.find(filter).sort({ order: 1, createdAt: 1 }).lean();
  const ids = habits.map((h) => h._id);
  const from = shiftDay(today, -400);
  const logs = await HabitLogModel.find({ habit: { $in: ids }, completed: true, date: { $gte: from, $lte: today } })
    .select('habit date')
    .lean();

  const byHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    const k = String(l.habit);
    if (!byHabit.has(k)) byHabit.set(k, new Set());
    byHabit.get(k)!.add(l.date);
  }

  const week = lastNDays(today, 7);
  return habits.map((h) => {
    const done = byHabit.get(String(h._id)) ?? new Set<string>();
    return {
      ...h,
      scheduledToday: isScheduledOn(h, today),
      completedToday: done.has(today),
      streak: computeStreaks(h, done, today),
      last7: week.map((d) => ({ date: d, scheduled: isScheduledOn(h, d), done: done.has(d) })),
    };
  });
}

export async function setHabitCompletion(userId: string, habitId: string, date: string, completed: boolean) {
  if (completed) {
    await HabitLogModel.updateOne(
      { habit: habitId, date },
      { $set: { completed: true, user: userId } },
      { upsert: true },
    );
  } else {
    await HabitLogModel.deleteOne({ habit: habitId, date, user: userId });
  }
}

/** Per-day completion ratio across all active habits — powers heatmap + weekly charts. */
export async function dailyCompletion(userId: string, days: string[]) {
  const habits = await HabitModel.find({ user: userId, deletedAt: null, archived: false })
    .select('frequency daysOfWeek createdAt')
    .lean();
  const logs = await HabitLogModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        user: new Types.ObjectId(userId),
        completed: true,
        date: { $gte: days[0], $lte: days[days.length - 1] },
        habit: { $in: habits.map((h) => h._id) },
      },
    },
    { $group: { _id: '$date', count: { $sum: 1 } } },
  ]);
  const doneMap = new Map(logs.map((l) => [l._id, l.count]));
  return days.map((date) => {
    const scheduled = habits.filter((h) => isScheduledOn(h, date)).length;
    const done = doneMap.get(date) ?? 0;
    return { date, scheduled, done, ratio: scheduled ? Math.min(1, done / scheduled) : 0 };
  });
}
