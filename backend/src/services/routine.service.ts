import { RoutineDayModel, RoutineModel } from '../models/routine.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { dayKey, weekdayOf } from '../utils/date.js';
import { nowIn } from '../utils/time.js';
import { toMinutesSafe } from '../utils/timeCore.js';

export async function routineForDay(userId: string, date: string) {
  const dow = weekdayOf(date);
  const [routine, day, profile] = await Promise.all([
    RoutineModel.findOne({ user: userId, isActive: true, days: dow }).sort({ order: 1 }).lean(),
    RoutineDayModel.findOne({ user: userId, date }).lean(),
    UserProfileModel.findOne({ user: userId }).select('personal.timezone').lean(),
  ]);
  const tz = profile?.personal?.timezone || 'Asia/Kolkata';
  const today = dayKey(new Date(), tz);
  const nowMin = nowIn(tz).minutes;
  const statuses = (day?.statuses ?? {}) as unknown as Record<string, string>;

  const activities = (routine?.activities ?? []).map((a) => {
    const explicit = statuses[String(a._id)] ?? null;
    const isPast = date < today || (date === today && toMinutesSafe(a.end) <= nowMin);
    const isNow = date === today && toMinutesSafe(a.start) <= nowMin && nowMin < toMinutesSafe(a.end);
    return { ...a, status: explicit ?? (isPast ? 'missed' : null), explicit: !!explicit, isNow };
  });
  const done = activities.filter((a) => a.status === 'done').length;
  return {
    date,
    routine: routine ? { _id: routine._id, name: routine.name } : null,
    activities,
    note: day?.note ?? '',
    stats: { total: activities.length, done, missed: activities.filter((a) => a.status === 'missed').length },
  };
}
