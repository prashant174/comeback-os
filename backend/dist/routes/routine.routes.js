import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { DAY_TYPES, DayOverrideModel, RoutineDayModel, RoutineModel } from '../models/routine.js';
import { shiftDay } from '../utils/date.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, hhmm, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { routineForDay } from '../services/routine.service.js';
const activity = z.object({
    _id: objectId.optional(),
    title: z.string().trim().min(1).max(80),
    start: hhmm,
    end: hhmm,
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    category: z.string().max(30).default('other'),
    notes: z.string().max(300).default(''),
}).refine((a) => a.start < a.end, { message: 'End must be after start', path: ['end'] });
const routineBody = z.object({
    name: z.string().trim().min(1).max(60),
    days: z.array(z.number().int().min(0).max(6)).max(7), // empty = on-demand routine (used for leave days)
    isActive: z.boolean().default(true),
    activities: z.array(activity).max(60).default([]),
    order: z.number().int().optional(),
});
const r = Router();
/** Today's (or ?date=) routine with per-activity status. Unlogged past activities show as "missed". */
r.get('/day', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
    const date = req.query.date ?? (await userToday(req.user.id));
    ok(res, await routineForDay(req.user.id, date));
}));
r.put('/day/:date/status', validate({
    params: z.object({ date: dayKeySchema }),
    body: z.object({ activityId: objectId, status: z.enum(['done', 'missed', 'skipped']).nullable() }),
}), asyncHandler(async (req, res) => {
    const { date } = req.params;
    const { activityId, status } = req.body;
    const update = status ? { $set: { [`statuses.${activityId}`]: status } } : { $unset: { [`statuses.${activityId}`]: 1 } };
    await RoutineDayModel.updateOne({ user: req.user.id, date }, update, { upsert: true });
    ok(res, { date, activityId, status });
}));
r.put('/day/:date/note', validate({ params: z.object({ date: dayKeySchema }), body: z.object({ note: z.string().max(2000) }) }), asyncHandler(async (req, res) => {
    await RoutineDayModel.updateOne({ user: req.user.id, date: req.params.date }, { $set: { note: req.body.note } }, { upsert: true });
    ok(res, { saved: true });
}));
/* ---- leave / holiday overrides ---- */
r.get('/overrides', validate({ query: z.object({ from: dayKeySchema.optional(), to: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
    const q = req.query;
    const from = q.from ?? shiftDay(await userToday(req.user.id), -30);
    const rows = await DayOverrideModel.find({ user: req.user.id, date: { $gte: from, ...(q.to ? { $lte: q.to } : {}) } })
        .sort({ date: 1 }).populate('routine', 'name').lean();
    ok(res, rows);
}));
/** Mark one day or a range (max 60 days) as leave. Existing marks in the range are replaced. */
r.post('/overrides', validate({ body: z.object({
        from: dayKeySchema, to: dayKeySchema,
        type: z.enum(DAY_TYPES).default('leave'),
        routine: objectId.nullable().default(null),
        note: z.string().max(200).default(''),
    }).refine((b) => b.from <= b.to, { message: '"to" must be on or after "from"', path: ['to'] }) }), asyncHandler(async (req, res) => {
    const { from, to, type, routine, note } = req.body;
    if (routine && !(await RoutineModel.exists({ _id: routine, user: req.user.id })))
        throw ApiError.badRequest('Routine not found');
    const dates = [];
    for (let d = from; d <= to; d = shiftDay(d, 1)) {
        dates.push(d);
        if (dates.length > 60)
            throw ApiError.badRequest('Mark at most 60 days at a time');
    }
    const groupId = crypto.randomUUID();
    await DayOverrideModel.bulkWrite(dates.map((date) => ({
        updateOne: { filter: { user: req.user.id, date }, update: { $set: { type, routine, note, groupId } }, upsert: true },
    })));
    ok(res, { dates, groupId }, undefined, 201);
}));
/** Remove one day, or the whole leave it belongs to (?group=true). */
r.delete('/overrides/:date', validate({ params: z.object({ date: dayKeySchema }), query: z.object({ group: z.enum(['true', 'false']).optional() }) }), asyncHandler(async (req, res) => {
    const o = await DayOverrideModel.findOne({ user: req.user.id, date: req.params.date }).lean();
    if (!o)
        throw ApiError.notFound('No leave marked on this day');
    const r2 = req.query.group === 'true' && o.groupId
        ? await DayOverrideModel.deleteMany({ user: req.user.id, groupId: o.groupId })
        : await DayOverrideModel.deleteOne({ _id: o._id });
    ok(res, { deleted: r2.deletedCount });
}));
/** Week view: which routine applies to each weekday. */
r.get('/week', asyncHandler(async (req, res) => {
    const routines = await RoutineModel.find({ user: req.user.id, isActive: true }).sort({ order: 1 }).lean();
    ok(res, Array.from({ length: 7 }, (_, dow) => {
        const rt = routines.find((x) => x.days.includes(dow));
        return { dayOfWeek: dow, routine: rt ? { _id: rt._id, name: rt.name, activities: rt.activities } : null };
    }));
}));
r.use('/', crudRouter({
    model: RoutineModel,
    create: routineBody,
    update: routineBody.partial(),
    sort: { order: 1, createdAt: 1 },
    transform: async (body, req, existing) => {
        // a weekday may only belong to one active routine — keeps "today's routine" unambiguous
        const days = body.days;
        const active = body.isActive ?? existing?.isActive ?? true;
        if (days?.length && active) {
            const clash = await RoutineModel.findOne({ user: req.user.id, isActive: true, days: { $in: days }, ...(existing ? { _id: { $ne: existing._id } } : {}) }).lean();
            if (clash)
                throw ApiError.conflict(`"${clash.name}" already covers one of these days. Remove the day there first or deactivate it.`);
        }
        if (body.activities)
            body.activities = [...body.activities].sort((a, b) => a.start.localeCompare(b.start));
        return body;
    },
}));
export default r;
//# sourceMappingURL=routine.routes.js.map