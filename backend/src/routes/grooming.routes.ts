import { Router } from 'express';
import { z } from 'zod';
import { ClothingItemModel, GroomingLogModel, GroomingTaskModel, OutfitModel } from '../models/grooming.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, idParam, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { lastNDays, shiftDay, weekdayOf } from '../utils/date.js';

const r = Router();

const taskBody = z.object({
  title: z.string().trim().min(1).max(80),
  category: z.enum(['skincare', 'hair', 'beard', 'dental', 'clothing', 'other']).default('other'),
  frequency: z.enum(['daily', 'weekly', 'interval']).default('daily'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0]),
  intervalDays: z.number().int().min(1).max(365).default(30),
  order: z.number().int().optional(),
});
r.use('/tasks', crudRouter({ model: GroomingTaskModel, create: taskBody, sort: { order: 1, createdAt: 1 }, filters: ['category', 'frequency'],
  afterWrite: async (doc, _req, op) => { if (op === 'delete') await GroomingLogModel.deleteMany({ task: doc._id }); } }));

/** Tasks due on a date. Interval tasks are due when last done ≥ intervalDays ago (or never). */
r.get('/today', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
  const date = (req.query as { date?: string }).date ?? (await userToday(req.user!.id));
  const tasks = await GroomingTaskModel.find({ user: req.user!.id }).sort({ order: 1 }).lean();
  const logs = await GroomingLogModel.find({ user: req.user!.id, date: { $gte: shiftDay(date, -365), $lte: date } }).select('task date').lean();
  const byTask = new Map<string, string[]>();
  for (const l of logs) { const k = String(l.task); byTask.set(k, [...(byTask.get(k) ?? []), l.date]); }
  const items = tasks.map((t) => {
    const dates = (byTask.get(String(t._id)) ?? []).sort();
    const doneToday = dates.includes(date);
    const lastDone = dates.filter((d) => d < date).pop() ?? null;
    let due = false;
    let nextDue: string | null = null;
    if (t.frequency === 'daily') due = true;
    else if (t.frequency === 'weekly') due = t.daysOfWeek.includes(weekdayOf(date));
    else {
      nextDue = lastDone ? shiftDay(lastDone, t.intervalDays) : date;
      due = nextDue <= date;
    }
    return { ...t, due: due || doneToday, doneToday, lastDone, nextDue };
  });
  const week = lastNDays(date, 7);
  ok(res, { date, items, week: week.map((d) => ({ date: d, done: logs.filter((l) => l.date === d).length })) });
}));

r.post('/tasks/:id/log', validate({ params: idParam, body: z.object({ date: dayKeySchema.optional(), done: z.boolean() }) }), asyncHandler(async (req, res) => {
  const task = await GroomingTaskModel.exists({ _id: req.params.id, user: req.user!.id });
  if (!task) throw ApiError.notFound('Task not found');
  const date = req.body.date ?? (await userToday(req.user!.id));
  if (req.body.done) await GroomingLogModel.updateOne({ task: req.params.id, date }, { $set: { user: req.user!.id } }, { upsert: true });
  else await GroomingLogModel.deleteOne({ task: req.params.id, date, user: req.user!.id });
  ok(res, { date, done: req.body.done });
}));

r.get('/history', asyncHandler(async (req, res) => {
  const today = await userToday(req.user!.id);
  const logs = await GroomingLogModel.find({ user: req.user!.id, date: { $gte: shiftDay(today, -60) } }).sort({ date: -1 }).populate('task', 'title category').lean();
  ok(res, logs);
}));

const clothingBody = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().max(30).default('top'),
  color: z.string().max(30).default(''),
  condition: z.enum(['new', 'good', 'worn', 'replace']).default('good'),
  wishlist: z.boolean().default(false),
  price: z.number().min(0).max(1_000_000).default(0),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});
r.use('/clothing', crudRouter({ model: ClothingItemModel, create: clothingBody, filters: ['wishlist', 'category'], searchFields: ['name', 'color'], sort: { category: 1, name: 1 } }));

const outfitBody = z.object({ date: dayKeySchema, items: z.array(objectId).max(10).default([]), note: z.string().max(200).default('') });
r.use('/outfits', crudRouter({
  model: OutfitModel, create: outfitBody, dateField: 'date', sort: { date: 1 },
  transform: async (body, req) => {
    if (body.items?.length) {
      const n = await ClothingItemModel.countDocuments({ _id: { $in: body.items }, user: req.user!.id });
      if (n !== body.items.length) throw ApiError.badRequest('One or more clothing items not found');
    }
    return body;
  },
}));

export default r;
