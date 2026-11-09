import { Schema, model, Types } from 'mongoose';

const hhmm = { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true };

const activitySchema = new Schema({
  title: { type: String, required: true, maxlength: 80 },
  start: hhmm,
  end: hhmm,
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  category: { type: String, default: 'other', maxlength: 30 },
  notes: { type: String, default: '', maxlength: 300 },
});

/** A routine applies to a set of weekdays (e.g. Mon–Fri). Activities are embedded: small, bounded, edited together. */
const routineSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 60 },
    days: { type: [Number], default: [1, 2, 3, 4, 5] },
    isActive: { type: Boolean, default: true },
    activities: { type: [activitySchema], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const RoutineModel = model('Routine', routineSchema);

/** One document per user per day: completion state of that day's activities + a note. */
const routineDaySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    routine: { type: Types.ObjectId, ref: 'Routine', default: null },
    statuses: { type: Map, of: String, default: {} }, // activityId → done|missed|skipped (validated at the API)
    note: { type: String, default: '', maxlength: 2000 },
  },
  { timestamps: true },
);
routineDaySchema.index({ user: 1, date: 1 }, { unique: true });
export const RoutineDayModel = model('RoutineDay', routineDaySchema);

/**
 * A date marked as leave / holiday / sick day etc. On that date the chosen
 * routine replaces the normal weekday routine, and reminders flagged
 * skipOnLeave stay quiet.
 */
export const DAY_TYPES = ['leave', 'holiday', 'sick', 'wfh', 'travel', 'other'] as const;
const dayOverrideSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    type: { type: String, enum: DAY_TYPES, default: 'leave' },
    routine: { type: Types.ObjectId, ref: 'Routine', default: null }, // null = no routine that day
    note: { type: String, default: '', maxlength: 200 },
    groupId: { type: String, default: null }, // days created together (a multi-day leave)
  },
  { timestamps: true },
);
dayOverrideSchema.index({ user: 1, date: 1 }, { unique: true });
export const DayOverrideModel = model('DayOverride', dayOverrideSchema);
