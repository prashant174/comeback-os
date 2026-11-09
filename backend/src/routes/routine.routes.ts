import { Router } from 'express';
import { z } from 'zod';
import { RoutineDayModel, RoutineModel } from '../models/routine.js';
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
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  isActive: z.boolean().default(true),
  activities: z.array(activity).max(60).default([]),
  order: z.number().int().optional(),
});

const r = Router();

/** Today's (or ?date=) routine with per-activity status. Unlogged past activities show as "missed". */
r.get('/day', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
  const date = (req.query as { date?: string }).date ?? (await userToday(req.user!.id));
  ok(res, await routineForDay(req.user!.id, date));
}));

r.put('/day/:date/status', validate({
  params: z.object({ date: dayKeySchema }),
  body: z.object({ activityId: objectId, status: z.enum(['done', 'missed', 'skipped']).nullable() }),
}), asyncHandler(async (req, res) => {
  const { date } = req.params;
  const { activityId, status } = req.body as { activityId: string; status: string | null };
  const update = status ? { $set: { [`statuses.${activityId}`]: status } } : { $unset: { [`statuses.${activityId}`]: 1 } };
  await RoutineDayModel.updateOne({ user: req.user!.id, date }, update, { upsert: true });
  ok(res, { date, activityId, status });
}));

r.put('/day/:date/note', validate({ params: z.object({ date: dayKeySchema }), body: z.object({ note: z.string().max(2000) }) }),
  asyncHandler(async (req, res) => {
    await RoutineDayModel.updateOne({ user: req.user!.id, date: req.params.date }, { $set: { note: req.body.note } }, { upsert: true });
    ok(res, { saved: true });
  }));

/** Week view: which routine applies to each weekday. */
r.get('/week', asyncHandler(async (req, res) => {
  const routines = await RoutineModel.find({ user: req.user!.id, isActive: true }).sort({ order: 1 }).lean();
  ok(res, Array.from({ length: 7 }, (_, dow) => {
    const rt = routines.find((x) => x.days.includes(dow));
    return { dayOfWeek: dow, routine: rt ? { _id: rt._id, name: rt.name, activities: rt.activities } : null };
  }));
}));

r.use('/', crudRouter({
  model: RoutineModel,
  create: routineBody as unknown as z.AnyZodObject,
  update: routineBody.partial(),
  sort: { order: 1, createdAt: 1 },
  transform: async (body, req, existing) => {
    // a weekday may only belong to one active routine — keeps "today's routine" unambiguous
    const days: number[] | undefined = body.days;
    const active = body.isActive ?? existing?.isActive ?? true;
    if (days && active) {
      const clash = await RoutineModel.findOne({ user: req.user!.id, isActive: true, days: { $in: days }, ...(existing ? { _id: { $ne: existing._id } } : {}) }).lean();
      if (clash) throw ApiError.conflict(`"${clash.name}" already covers one of these days. Remove the day there first or deactivate it.`);
    }
    if (body.activities) body.activities = [...body.activities].sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));
    return body;
  },
}));

export default r;
