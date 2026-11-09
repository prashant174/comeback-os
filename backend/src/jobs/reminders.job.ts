import { ReminderModel, NotificationModel } from '../models/notify.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { dayKey } from '../utils/date.js';
import { nowIn } from '../utils/time.js';
import { logger } from '../utils/logger.js';

const LINKS: Record<string, string> = { workout: '/fitness', meal: '/nutrition', water: '/water', study: '/learning', sleep: '/sleep', review: '/analytics', budget: '/finance', wake: '/routine' };

/**
 * Turns due reminders into in-app notifications. Runs every minute in the API
 * process; a reminder fires once per day (lastFiredDate + dedupeKey guard),
 * with a 30-minute catch-up window so a briefly sleeping free-tier server
 * still delivers reminders when it wakes.
 */
export async function runRemindersTick(now = new Date()) {
  const reminders = await ReminderModel.find({ enabled: true }).lean();
  if (!reminders.length) return 0;
  const userIds = [...new Set(reminders.map((r) => String(r.user)))];
  const profiles = await UserProfileModel.find({ user: { $in: userIds } }).select('user personal.timezone').lean();
  const tzOf = new Map(profiles.map((p) => [String(p.user), p.personal?.timezone || 'Asia/Kolkata']));
  let fired = 0;
  for (const r of reminders) {
    const tz = tzOf.get(String(r.user)) ?? 'Asia/Kolkata';
    const { minutes, weekday } = nowIn(tz, now);
    const today = dayKey(now, tz);
    const [h, m] = r.time.split(':').map(Number);
    const due = h * 60 + m;
    if (!r.days.includes(weekday) || r.lastFiredDate === today || minutes < due || minutes > due + 30) continue;
    const key = `reminder:${r._id}:${today}`;
    const res = await NotificationModel.updateOne(
      { user: r.user, dedupeKey: key },
      { $setOnInsert: { user: r.user, dedupeKey: key, title: r.title, body: `Scheduled for ${r.time}`, kind: r.type, link: LINKS[r.type] ?? null } },
      { upsert: true },
    );
    await ReminderModel.updateOne({ _id: r._id }, { lastFiredDate: today });
    if (res.upsertedCount) fired++;
  }
  return fired;
}

export function startReminderJob() {
  const tick = () => runRemindersTick().catch((e) => logger.error('reminder tick failed', { e: e?.message }));
  const t = setInterval(tick, 60_000);
  t.unref();
  tick();
  return t;
}
