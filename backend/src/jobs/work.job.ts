import { WorkTaskModel } from '../models/work.js';
import { NotificationModel } from '../models/notify.js';
import { DayOverrideModel } from '../models/routine.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { dayKey } from '../utils/date.js';
import { nowIn } from '../utils/time.js';

const OFF_DAY = ['leave', 'holiday', 'sick', 'travel'];
const AT = 9 * 60 + 30; // 9:30 AM in the user's timezone, 30-min catch-up window

/** One "work tasks due" notification per user per day; silent on leave/holiday. */
export async function runWorkDueTick(now = new Date()) {
  const users = await WorkTaskModel.distinct('user', { status: { $ne: 'done' }, dueDate: { $ne: null } });
  if (!users.length) return 0;
  const profiles = await UserProfileModel.find({ user: { $in: users } }).select('user personal.timezone').lean();
  const tzOf = new Map(profiles.map((p) => [String(p.user), p.personal?.timezone || 'Asia/Kolkata']));
  let sent = 0;
  for (const user of users) {
    const tz = tzOf.get(String(user)) ?? 'Asia/Kolkata';
    const { minutes } = nowIn(tz, now);
    if (minutes < AT || minutes > AT + 30) continue;
    const today = dayKey(now, tz);
    const key = `work-due:${user}:${today}`;
    if (await NotificationModel.exists({ user, dedupeKey: key })) continue;
    if (await DayOverrideModel.exists({ user, date: today, type: { $in: OFF_DAY } })) continue;
    const open = { user, status: { $ne: 'done' } };
    const [due, overdue] = await Promise.all([
      WorkTaskModel.countDocuments({ ...open, dueDate: today }),
      WorkTaskModel.countDocuments({ ...open, dueDate: { $lt: today, $ne: null } }),
    ]);
    if (!due && !overdue) continue;
    const title = due ? `${due} work task${due > 1 ? 's' : ''} due today` : `${overdue} overdue work task${overdue > 1 ? 's' : ''}`;
    const body = due && overdue ? `Plus ${overdue} overdue.` : 'Open the Work board to plan your day.';
    const res = await NotificationModel.updateOne(
      { user, dedupeKey: key },
      { $setOnInsert: { user, dedupeKey: key, title, body, kind: 'work', link: '/work' } },
      { upsert: true },
    );
    if (res.upsertedCount) sent++;
  }
  return sent;
}
