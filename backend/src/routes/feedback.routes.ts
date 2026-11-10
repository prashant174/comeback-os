import { Router } from 'express';
import { z } from 'zod';
import { FeedbackModel } from '../models/admin.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';

/** Testers send bugs / ideas from inside the app; the admin reviews them in the panel. */
const r = Router();

r.post('/', validate({ body: z.object({
  type: z.enum(['bug', 'idea', 'other']).default('bug'),
  message: z.string().trim().min(5, 'Tell us a bit more (5+ characters)').max(2000),
  page: z.string().max(200).default(''),
}) }), asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 86400_000);
  if ((await FeedbackModel.countDocuments({ user: req.user!.id, createdAt: { $gte: since } })) >= 20) {
    throw ApiError.badRequest('Daily feedback limit reached (20). Thanks for all the reports!');
  }
  const f = await FeedbackModel.create({ ...req.body, user: req.user!.id, userAgent: (req.get('user-agent') ?? '').slice(0, 300) });
  created(res, { _id: f._id, status: f.status });
}));

/** The user's own submissions and whether they were resolved. */
r.get('/mine', asyncHandler(async (req, res) => {
  ok(res, await FeedbackModel.find({ user: req.user!.id }).sort({ createdAt: -1 }).limit(50).select('type message status adminNote createdAt').lean());
}));

export default r;
