import { Router } from 'express';
import { z } from 'zod';
import { BudgetModel, ExpenseModel } from '../models/finance.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { checkBudgetAlerts, financeSummary, monthRange } from '../services/finance.service.js';
import { logger } from '../utils/logger.js';

const r = Router();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');

const expenseBody = z.object({
  date: dayKeySchema,
  amount: z.number().positive().max(10_000_000).transform((n) => Math.round(n * 100) / 100),
  category: z.string().trim().min(1).max(40),
  note: z.string().max(200).default(''),
  recurring: z.boolean().default(false),
});
r.use('/expenses', crudRouter({
  model: ExpenseModel, create: expenseBody, dateField: 'date', filters: ['category', 'recurring'], searchFields: ['note', 'category'],
  sort: { date: -1, createdAt: -1 }, maxLimit: 500,
  afterWrite: async (doc, req, op) => {
    if (op === 'delete') return;
    checkBudgetAlerts(req.user!.id, doc.date, doc.category).catch((e) => logger.error('budget alert failed', { e: e?.message }));
  },
}));

r.get('/budget', asyncHandler(async (req, res) => {
  const b = await BudgetModel.findOneAndUpdate({ user: req.user!.id }, { $setOnInsert: { user: req.user!.id, categories: [] } }, { upsert: true, new: true });
  ok(res, b);
}));
r.put('/budget', validate({ body: z.object({
  categories: z.array(z.object({ name: z.string().trim().min(1).max(40), limit: z.number().min(0).max(10_000_000) })).max(30)
    .refine((c) => new Set(c.map((x) => x.name.toLowerCase())).size === c.length, 'Category names must be unique'),
  alertAtPct: z.number().int().min(50).max(100).default(90),
}) }), asyncHandler(async (req, res) => {
  ok(res, await BudgetModel.findOneAndUpdate({ user: req.user!.id }, { $set: req.body }, { upsert: true, new: true, runValidators: true }));
}));

r.get('/summary', validate({ query: z.object({ month: monthSchema.optional() }) }), asyncHandler(async (req, res) => {
  const month = (req.query as { month?: string }).month ?? (await userToday(req.user!.id)).slice(0, 7);
  ok(res, await financeSummary(req.user!.id, month));
}));

/** Copies last month's recurring expenses into `month` (skips ones already copied). */
r.post('/recurring/apply', validate({ body: z.object({ month: monthSchema }) }), asyncHandler(async (req, res) => {
  const { month } = req.body as { month: string };
  const [y, m] = month.split('-').map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const p = monthRange(prev);
  const cur = monthRange(month);
  const templates = await ExpenseModel.find({ user: req.user!.id, recurring: true, date: { $gte: p.from, $lte: p.to } }).lean();
  const existing = await ExpenseModel.find({ user: req.user!.id, date: { $gte: cur.from, $lte: cur.to }, recurringSource: { $ne: null } }).select('recurringSource').lean();
  const seen = new Set(existing.map((e) => String(e.recurringSource)));
  const toCreate = templates.filter((t) => !seen.has(String(t._id))).map((t) => ({
    user: req.user!.id, date: `${month}-${t.date.slice(8, 10) > String(cur.days) ? String(cur.days) : t.date.slice(8, 10)}`,
    amount: t.amount, category: t.category, note: t.note, recurring: true, recurringSource: t._id,
  }));
  created(res, await ExpenseModel.insertMany(toCreate));
}));

export default r;
