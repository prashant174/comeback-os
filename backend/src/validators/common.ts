import { z } from 'zod';
import { isValidDayKey } from '../utils/date.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });
export const dayKeySchema = z.string().refine(isValidDayKey, 'Date must be YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)');
