import crypto from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { AdminAuditModel } from '../models/admin.js';
import { revokeAllForUser } from './token.service.js';
import { dayKey, lastNDays } from '../utils/date.js';

/** Collections whose documents count as "the user did something" (for activity metrics). */
// Only collections written by user actions (seeded starter data would count every signup as "active")
const ACTIVITY_MODELS = ['HabitLog', 'WaterLog', 'MealEntry', 'WorkoutLog', 'StudySession', 'SleepRecord', 'Journal', 'Expense', 'BodyMeasurement', 'GroomingLog', 'RoutineDay', 'DayOverride', 'Feedback', 'WorkTask', 'WorkLog', 'Requirement', 'Meeting', 'ChangeLog'];
const FREE_TIER_BYTES = 512 * 1024 * 1024; // MongoDB Atlas M0

export const audit = (admin: string, action: string, target?: { _id?: unknown; email?: string } | null, details?: unknown) =>
  AdminAuditModel.create({ admin, action, targetUser: target?._id ?? null, targetEmail: target?.email ?? null, details: details ?? null });

/** Temporary password the admin can pass on; the user should change it after logging in. */
export const tempPassword = () => {
  const words = crypto.randomBytes(6).toString('base64url').replace(/[-_]/g, 'x');
  return `Cb-${words}${crypto.randomInt(10, 99)}`;
};

async function countsByUser(userIds: Types.ObjectId[]) {
  const totals = new Map<string, number>();
  const lastActive = new Map<string, Date>();
  await Promise.all(ACTIVITY_MODELS.map(async (name) => {
    const m = mongoose.models[name];
    if (!m) return;
    const rows = await m.aggregate<{ _id: Types.ObjectId; n: number; last: Date }>([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', n: { $sum: 1 }, last: { $max: '$createdAt' } } },
    ]);
    for (const r of rows) {
      const k = String(r._id);
      totals.set(k, (totals.get(k) ?? 0) + r.n);
      if (!lastActive.get(k) || r.last > lastActive.get(k)!) lastActive.set(k, r.last);
    }
  }));
  return { totals, lastActive };
}

/** User list with usage metadata only — never the content of journals, meals, photos etc. */
export async function listUsers(opts: { q?: string; status?: string; page: number; limit: number }) {
  const filter: Record<string, unknown> = {};
  if (opts.q) {
    const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (opts.status === 'active') filter.isActive = true;
  if (opts.status === 'disabled') filter.isActive = false;
  const [users, total] = await Promise.all([
    UserModel.find(filter).sort({ role: 1, createdAt: -1 }).skip((opts.page - 1) * opts.limit).limit(opts.limit).lean(),
    UserModel.countDocuments(filter),
  ]);
  const ids = users.map((u) => u._id);
  const [{ totals, lastActive }, sessions, photos] = await Promise.all([
    countsByUser(ids),
    RefreshTokenModel.aggregate<{ _id: Types.ObjectId; lastSeen: Date; active: number }>([
      { $match: { user: { $in: ids } } },
      { $group: { _id: '$user', lastSeen: { $max: '$createdAt' }, active: { $sum: { $cond: [{ $and: [{ $eq: ['$revokedAt', null] }, { $gt: ['$expiresAt', new Date()] }] }, 1, 0] } } } },
    ]),
    mongoose.connection.db!.collection('uploads.files').aggregate<{ _id: string; n: number; bytes: number }>([
      { $match: { 'metadata.owner': { $in: ids.map(String) } } },
      { $group: { _id: '$metadata.owner', n: { $sum: 1 }, bytes: { $sum: '$length' } } },
    ]).toArray(),
  ]);
  const sMap = new Map(sessions.map((s) => [String(s._id), s]));
  const pMap = new Map(photos.map((p) => [p._id, p]));
  return {
    total,
    items: users.map((u) => {
      const k = String(u._id);
      return {
        _id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive,
        createdAt: (u as { createdAt?: Date }).createdAt, lastLoginAt: u.lastLoginAt,
        lastSeenAt: sMap.get(k)?.lastSeen ?? u.lastLoginAt ?? null,
        lastActivityAt: lastActive.get(k) ?? null,
        activeSessions: sMap.get(k)?.active ?? 0,
        entries: totals.get(k) ?? 0,
        photos: pMap.get(k)?.n ?? 0,
        photoBytes: pMap.get(k)?.bytes ?? 0,
      };
    }),
  };
}

export async function overview() {
  const db = mongoose.connection.db!;
  const since7 = new Date(Date.now() - 7 * 86400000);
  const [users, admins, disabled, new7, stats, colls, activeIds] = await Promise.all([
    UserModel.countDocuments({ role: 'user' }),
    UserModel.countDocuments({ role: 'admin' }),
    UserModel.countDocuments({ role: 'user', isActive: false }),
    UserModel.countDocuments({ role: 'user', createdAt: { $gte: since7 } }),
    db.stats(),
    db.listCollections({}, { nameOnly: true }).toArray(),
    Promise.all(ACTIVITY_MODELS.map((n) => mongoose.models[n]?.distinct('user', { createdAt: { $gte: since7 } }) ?? [])),
  ]);
  const collections = await Promise.all(colls.map(async (c) => {
    const s = await db.command({ collStats: c.name }).catch(() => null) as { count?: number; size?: number; totalIndexSize?: number } | null;
    return { name: c.name, count: s?.count ?? 0, bytes: (s?.size ?? 0) + (s?.totalIndexSize ?? 0) };
  }));
  const used = (stats.dataSize ?? 0) + (stats.indexSize ?? 0);
  const mem = process.memoryUsage();
  return {
    users: { total: users, admins, disabled, newLast7Days: new7, activeLast7Days: new Set(activeIds.flat().map(String)).size },
    storage: { usedBytes: used, limitBytes: FREE_TIER_BYTES, pct: Math.round((used / FREE_TIER_BYTES) * 1000) / 10, collections: collections.sort((a, b) => b.bytes - a.bytes) },
    server: { uptimeSec: Math.round(process.uptime()), node: process.version, rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), env: process.env.NODE_ENV ?? 'development' },
  };
}

/** Daily active users + signups for the last N days (IST day boundaries). */
export async function activity(days = 30, tz = 'Asia/Kolkata') {
  const keys = lastNDays(dayKey(new Date(), tz), days);
  const since = new Date(Date.now() - (days + 1) * 86400000);
  const perDay = new Map<string, Set<string>>(keys.map((k) => [k, new Set()]));
  await Promise.all(ACTIVITY_MODELS.map(async (name) => {
    const m = mongoose.models[name];
    if (!m) return;
    const rows = await m.aggregate<{ _id: { d: string; u: Types.ObjectId } }>([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }, u: '$user' } } },
    ]);
    for (const r of rows) perDay.get(r._id.d)?.add(String(r._id.u));
  }));
  const signups = await UserModel.aggregate<{ _id: string; n: number }>([
    { $match: { role: 'user', createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }, n: { $sum: 1 } } },
  ]);
  const sMap = new Map(signups.map((s) => [s._id, s.n]));
  return keys.map((date) => ({ date, activeUsers: perDay.get(date)!.size, signups: sMap.get(date) ?? 0 }));
}

/** Removes a user and every document that belongs to them, including stored photos. */
export async function deleteUserCompletely(userId: string) {
  const uid = new Types.ObjectId(userId);
  let docs = 0;
  for (const m of Object.values(mongoose.models)) {
    if (m.modelName === 'User' || !m.schema.path('user')) continue;
    const r = await m.deleteMany({ user: uid });
    docs += r.deletedCount ?? 0;
  }
  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'uploads' });
  const files = await bucket.find({ 'metadata.owner': userId }).toArray();
  for (const f of files) await bucket.delete(f._id).catch(() => {});
  await UserModel.deleteOne({ _id: uid });
  return { documents: docs, files: files.length };
}

export async function setPassword(userId: string, password: string) {
  await UserModel.updateOne({ _id: userId }, { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: new Date() });
  await revokeAllForUser(userId);
}
