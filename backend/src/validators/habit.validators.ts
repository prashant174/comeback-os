import { z } from 'zod';
import { HABIT_CATEGORIES } from '../models/Habit.js';
import { dayKeySchema } from './common.js';

const base = {
  name: z.string().trim().min(1).max(80),
  description: z.string().max(300).optional(),
  category: z.enum(HABIT_CATEGORIES).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).nullable().optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
};

export const createHabitSchema = z.object(base);
export const updateHabitSchema = z.object({ ...base, name: base.name.optional(), archived: z.boolean().optional() });
export const toggleHabitSchema = z.object({ date: dayKeySchema.optional(), completed: z.boolean() });
export const reorderSchema = z.object({ ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(200) });
export const listHabitsQuery = z.object({ includeArchived: z.enum(['true', 'false']).optional(), date: dayKeySchema.optional() });
export const heatmapQuery = z.object({ days: z.coerce.number().int().min(7).max(366).default(90) });
