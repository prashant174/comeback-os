import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const HABIT_CATEGORIES = [
  'routine', 'fitness', 'nutrition', 'learning', 'finance', 'grooming', 'sleep', 'mind', 'other',
] as const;

const habitSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 300 },
    category: { type: String, enum: HABIT_CATEGORIES, default: 'other' },
    icon: { type: String, default: 'check' },
    color: { type: String, default: null },
    /** daily = every day; weekly = only on `daysOfWeek` (0=Sun..6=Sat) */
    frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    order: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

habitSchema.index({ user: 1, archived: 1, deletedAt: 1, order: 1 });

export type Habit = InferSchemaType<typeof habitSchema>;
export type HabitDoc = HydratedDocument<Habit>;
export const HabitModel = model('Habit', habitSchema);
