import { Schema, model, Types } from 'mongoose';

const exerciseSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    muscleGroup: { type: String, default: 'full body', maxlength: 40 },
    type: { type: String, enum: ['reps', 'time'], default: 'reps' },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    instructions: { type: String, default: '', maxlength: 1500 },
    videoUrl: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);
export const ExerciseModel = model('Exercise', exerciseSchema);

const planItemSchema = new Schema(
  {
    exercise: { type: Types.ObjectId, ref: 'Exercise', default: null },
    name: { type: String, required: true, maxlength: 80 },
    sets: { type: Number, min: 0, max: 20, default: 3 },
    reps: { type: Number, min: 0, max: 500, default: 10 },
    durationSec: { type: Number, min: 0, max: 7200, default: 0 },
    restSec: { type: Number, min: 0, max: 600, default: 60 },
  },
  { _id: false },
);

/** One plan document per weekday (0=Sun..6=Sat). */
const workoutPlanSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    title: { type: String, required: true, maxlength: 60 },
    focus: { type: String, enum: ['strength', 'recovery', 'conditioning', 'rest'], default: 'strength' },
    items: { type: [planItemSchema], default: [] },
  },
  { timestamps: true },
);
workoutPlanSchema.index({ user: 1, dayOfWeek: 1 }, { unique: true });
export const WorkoutPlanModel = model('WorkoutPlan', workoutPlanSchema);

const logSetSchema = new Schema({ reps: { type: Number, min: 0, max: 1000, default: 0 }, durationSec: { type: Number, min: 0, max: 7200, default: 0 } }, { _id: false });
const logEntrySchema = new Schema({ exercise: { type: Types.ObjectId, ref: 'Exercise', default: null }, name: { type: String, required: true }, sets: { type: [logSetSchema], default: [] } }, { _id: false });

const workoutLogSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, required: true, maxlength: 60 },
    durationMin: { type: Number, min: 0, max: 600, default: 0 },
    entries: { type: [logEntrySchema], default: [] },
    completed: { type: Boolean, default: true },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);
workoutLogSchema.index({ user: 1, date: -1 });
export const WorkoutLogModel = model('WorkoutLog', workoutLogSchema);

const bodyMeasurementSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    weightKg: { type: Number, min: 20, max: 400, default: null },
    waistCm: { type: Number, min: 0, max: 300, default: null },
    chestCm: { type: Number, min: 0, max: 300, default: null },
    armCm: { type: Number, min: 0, max: 100, default: null },
    thighCm: { type: Number, min: 0, max: 150, default: null },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);
bodyMeasurementSchema.index({ user: 1, date: -1 });
export const BodyMeasurementModel = model('BodyMeasurement', bodyMeasurementSchema);

const progressPhotoSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    filename: { type: String, required: true },
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);
export const ProgressPhotoModel = model('ProgressPhoto', progressPhotoSchema);
