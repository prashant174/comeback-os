import { z } from 'zod';
import { dayKeySchema } from './common.js';
export const addWaterSchema = z.object({ amountMl: z.number().int().min(1).max(5000), date: dayKeySchema.optional() });
export const waterDayQuery = z.object({ date: dayKeySchema.optional() });
export const waterHistoryQuery = z.object({ days: z.coerce.number().int().min(1).max(366).default(30) });
//# sourceMappingURL=water.validators.js.map