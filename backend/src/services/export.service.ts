import { ExpenseModel } from '../models/finance.js';
import { WaterLogModel } from '../models/WaterLog.js';
import { SleepRecordModel, JournalModel } from '../models/wellbeing.js';
import { StudySessionModel } from '../models/learning.js';
import { WorkoutLogModel, BodyMeasurementModel } from '../models/fitness.js';
import { MealEntryModel } from '../models/nutrition.js';
import { HabitLogModel } from '../models/HabitLog.js';

export const EXPORT_MODULES = ['expenses', 'water', 'sleep', 'study', 'workouts', 'meals', 'habits', 'measurements', 'journal'] as const;
export type ExportModule = (typeof EXPORT_MODULES)[number];

/** RFC 4180 CSV with formula-injection protection (cells starting with = + - @ are prefixed). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\r\n');
}

export async function exportRows(userId: string, module: ExportModule, from: string, to: string) {
  const q = { user: userId, date: { $gte: from, $lte: to } };
  switch (module) {
    case 'expenses': return { cols: ['date', 'category', 'amount', 'note', 'recurring'], rows: await ExpenseModel.find(q).sort({ date: 1 }).lean() };
    case 'water': return { cols: ['date', 'amountMl', 'loggedAt'], rows: await WaterLogModel.find(q).sort({ loggedAt: 1 }).lean() };
    case 'sleep': return { cols: ['date', 'bedtime', 'wakeTime', 'durationMin', 'quality', 'notes'], rows: await SleepRecordModel.find(q).sort({ date: 1 }).lean() };
    case 'study': return { cols: ['date', 'minutes', 'kind', 'topic', 'mode', 'notes'], rows: await StudySessionModel.find(q).sort({ date: 1 }).lean() };
    case 'workouts': {
      const logs = await WorkoutLogModel.find(q).sort({ date: 1 }).lean();
      return { cols: ['date', 'title', 'durationMin', 'completed', 'exercises', 'notes'], rows: logs.map((l) => ({ ...l, exercises: l.entries.map((e) => `${e.name} ${e.sets.map((s) => s.reps || `${s.durationSec}s`).join('/')}`) })) };
    }
    case 'meals': {
      const rows = await MealEntryModel.find(q).sort({ date: 1 }).lean();
      return { cols: ['date', 'mealType', 'foodName', 'quantityG', 'kcal', 'protein', 'carbs', 'fat', 'fiber', 'estimated'], rows: rows.map((r) => ({ ...r, ...r.macros })) };
    }
    case 'habits': {
      const rows = await HabitLogModel.find({ ...q, completed: true }).populate('habit', 'name').sort({ date: 1 }).lean();
      return { cols: ['date', 'habit'], rows: rows.map((r) => ({ date: r.date, habit: (r.habit as unknown as { name?: string })?.name ?? '' })) };
    }
    case 'measurements': return { cols: ['date', 'weightKg', 'waistCm', 'chestCm', 'armCm', 'thighCm', 'notes'], rows: await BodyMeasurementModel.find(q).sort({ date: 1 }).lean() };
    case 'journal': return { cols: ['date', 'mood', 'achievements', 'challenges', 'reflection', 'ideas', 'tags'], rows: await JournalModel.find(q).sort({ date: 1 }).lean() };
  }
}
