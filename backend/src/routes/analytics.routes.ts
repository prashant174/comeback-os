import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { analytics } from '../services/analytics.service.js';
import { EXPORT_MODULES, exportRows, toCsv, type ExportModule } from '../services/export.service.js';
import { lastNDays, shiftDay } from '../utils/date.js';
import { ApiError } from '../utils/ApiError.js';

const r = Router();

r.get('/', validate({ query: z.object({ days: z.coerce.number().int().min(7).max(366).default(30) }) }), asyncHandler(async (req, res) => {
  const today = await userToday(req.user!.id);
  ok(res, await analytics(req.user!.id, lastNDays(today, Number((req.query as { days?: number }).days ?? 30))));
}));

r.get('/export', validate({ query: z.object({ module: z.enum(EXPORT_MODULES), from: dayKeySchema.optional(), to: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.query as { module: ExportModule; from?: string; to?: string };
  const today = await userToday(req.user!.id);
  const to = q.to ?? today;
  const from = q.from ?? shiftDay(to, -89);
  if (from > to) throw ApiError.badRequest('"from" must be before "to"');
  const { cols, rows } = await exportRows(req.user!.id, q.module, from, to);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="comeback-${q.module}-${from}_to_${to}.csv"`);
  res.send(toCsv(rows as unknown as Record<string, unknown>[], cols));
}));

export default r;
