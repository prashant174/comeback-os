import { Router } from 'express';
import { z } from 'zod';
import { NotificationModel, ReminderModel } from '../models/notify.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { hhmm, idParam } from '../validators/common.js';

export const remindersRouter = crudRouter({
  model: ReminderModel,
  create: z.object({
    title: z.string().trim().min(1).max(80),
    type: z.enum(['wake', 'workout', 'meal', 'water', 'study', 'sleep', 'review', 'budget', 'other']).default('other'),
    time: hhmm,
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
    enabled: z.boolean().default(true),
  }),
  sort: { time: 1 },
});

export const notificationsRouter = Router();
notificationsRouter.get('/', validate({ query: z.object({ since: z.coerce.date().optional() }) }), asyncHandler(async (req, res) => {
  const since = (req.query as { since?: Date }).since;
  const [items, unread] = await Promise.all([
    NotificationModel.find({ user: req.user!.id, ...(since ? { createdAt: { $gt: since } } : {}) }).sort({ createdAt: -1 }).limit(50).lean(),
    NotificationModel.countDocuments({ user: req.user!.id, readAt: null }),
  ]);
  ok(res, items, { unread });
}));
notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await NotificationModel.updateMany({ user: req.user!.id, readAt: null }, { readAt: new Date() });
  ok(res, { read: true });
}));
notificationsRouter.patch('/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const n = await NotificationModel.findOneAndUpdate({ _id: req.params.id, user: req.user!.id }, { readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound('Notification not found');
  ok(res, n);
}));
notificationsRouter.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const r = await NotificationModel.deleteOne({ _id: req.params.id, user: req.user!.id });
  if (!r.deletedCount) throw ApiError.notFound('Notification not found');
  ok(res, { deleted: true });
}));
