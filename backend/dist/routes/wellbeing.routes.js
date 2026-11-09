import { Router } from 'express';
import { z } from 'zod';
import { GoalModel, JournalModel, SleepRecordModel } from '../models/wellbeing.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, hhmm, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { lastNDays } from '../utils/date.js';
import { round1, sleepDuration, toMinutesSafe } from '../utils/timeCore.js';
/* ---------------- Sleep ---------------- */
export const sleepRouter = Router();
const sleepBody = z.object({
    date: dayKeySchema, bedtime: hhmm, wakeTime: hhmm,
    quality: z.number().int().min(1).max(5).default(3), notes: z.string().max(500).default(''),
});
sleepRouter.get('/summary', validate({ query: z.object({ days: z.coerce.number().int().min(3).max(366).default(14) }) }), asyncHandler(async (req, res) => {
    const uid = req.user.id;
    const days = lastNDays(await userToday(uid), Number(req.query.days ?? 14));
    const [records, profile] = await Promise.all([
        SleepRecordModel.find({ user: uid, date: { $gte: days[0], $lte: days[days.length - 1] } }).lean(),
        UserProfileModel.findOne({ user: uid }).select('targets.sleepHours schedule.sleep').lean(),
    ]);
    const map = new Map(records.map((r) => [r.date, r]));
    const series = days.map((d) => ({ date: d, hours: map.has(d) ? round1(map.get(d).durationMin / 60) : null, quality: map.get(d)?.quality ?? null, bedtime: map.get(d)?.bedtime ?? null }));
    const logged = records.length;
    const avgMin = logged ? records.reduce((s, r) => s + r.durationMin, 0) / logged : 0;
    // bedtime consistency: std-dev of bedtime in minutes (shifted so 18:00–05:59 is continuous)
    const bedMins = records.map((r) => { const m = toMinutesSafe(r.bedtime); return m < 18 * 60 ? m + 1440 : m; });
    const mean = bedMins.reduce((s, m) => s + m, 0) / (bedMins.length || 1);
    const sd = bedMins.length > 1 ? Math.sqrt(bedMins.reduce((s, m) => s + (m - mean) ** 2, 0) / bedMins.length) : null;
    const target = profile?.targets?.sleepHours ?? 0;
    ok(res, {
        series,
        stats: {
            logged, days: days.length,
            avgHours: round1(avgMin / 60),
            avgQuality: logged ? round1(records.reduce((s, r) => s + r.quality, 0) / logged) : null,
            bedtimeSdMin: sd === null ? null : Math.round(sd),
            nightsOnTarget: records.filter((r) => r.durationMin >= target * 60).length,
            targetHours: target,
            targetBedtime: profile?.schedule?.sleep ?? null,
        },
    });
}));
sleepRouter.use('/', crudRouter({
    model: SleepRecordModel, create: sleepBody, dateField: 'date', sort: { date: -1 },
    transform: (body, _req, existing) => {
        const bed = body.bedtime ?? existing?.bedtime;
        const wake = body.wakeTime ?? existing?.wakeTime;
        return bed && wake ? { ...body, durationMin: sleepDuration(bed, wake) } : body;
    },
}));
/* ---------------- Goals ---------------- */
export const goalsRouter = Router();
const goalBody = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(1000).default(''),
    category: z.string().max(30).default('personal'),
    horizon: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(90),
    startDate: dayKeySchema,
    deadline: dayKeySchema,
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(['active', 'completed', 'paused', 'dropped']).default('active'),
    progress: z.number().int().min(0).max(100).default(0),
    milestones: z.array(z.object({ _id: objectId.optional(), title: z.string().trim().min(1).max(120), done: z.boolean().default(false), dueDate: dayKeySchema.nullable().optional() })).max(50).default([]),
});
goalsRouter.use('/', crudRouter({
    model: GoalModel, create: goalBody, filters: ['status', 'category', 'horizon'], sort: { status: 1, deadline: 1 },
    transform: (body, _req, existing) => {
        const ms = body.milestones ?? existing?.milestones;
        // with milestones, progress is derived from them; without, it's set manually
        if (ms?.length)
            body.progress = Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
        if (body.progress === 100 && !body.status && existing?.status === 'active')
            body.status = 'completed';
        return body;
    },
}));
/* ---------------- Journal ---------------- */
export const journalRouter = Router();
const journalBody = z.object({
    date: dayKeySchema,
    mood: z.number().int().min(1).max(5).default(3),
    achievements: z.string().max(3000).default(''),
    challenges: z.string().max(3000).default(''),
    reflection: z.string().max(10000).default(''),
    ideas: z.string().max(3000).default(''),
    tags: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(20).default([]),
});
journalRouter.get('/tags', asyncHandler(async (req, res) => {
    ok(res, await JournalModel.distinct('tags', { user: req.user.id }));
}));
journalRouter.use('/', crudRouter({
    model: JournalModel, create: journalBody, dateField: 'date', filters: ['tags', 'mood'],
    searchFields: ['achievements', 'challenges', 'reflection', 'ideas', 'tags'], sort: { date: -1, createdAt: -1 },
}));
//# sourceMappingURL=wellbeing.routes.js.map