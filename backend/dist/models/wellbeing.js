import { Schema, model, Types } from 'mongoose';
const hhmm = { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true };
/** `date` = the morning you woke up. Quality is self-rated (no wearable). */
const sleepSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    bedtime: hhmm,
    wakeTime: hhmm,
    durationMin: { type: Number, min: 0, max: 1440, default: 0 },
    quality: { type: Number, min: 1, max: 5, default: 3 },
    notes: { type: String, default: '', maxlength: 500 },
}, { timestamps: true });
sleepSchema.index({ user: 1, date: 1 }, { unique: true });
export const SleepRecordModel = model('SleepRecord', sleepSchema);
const milestoneSchema = new Schema({
    title: { type: String, required: true, maxlength: 120 },
    done: { type: Boolean, default: false },
    dueDate: { type: String, default: null },
});
const goalSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    category: { type: String, default: 'personal', maxlength: 30 },
    horizon: { type: Number, enum: [30, 60, 90], default: 90 },
    startDate: { type: String, required: true },
    deadline: { type: String, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['active', 'completed', 'paused', 'dropped'], default: 'active' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    milestones: { type: [milestoneSchema], default: [] },
}, { timestamps: true });
export const GoalModel = model('Goal', goalSchema);
const journalSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    mood: { type: Number, min: 1, max: 5, default: 3 },
    achievements: { type: String, default: '', maxlength: 3000 },
    challenges: { type: String, default: '', maxlength: 3000 },
    reflection: { type: String, default: '', maxlength: 10000 },
    ideas: { type: String, default: '', maxlength: 3000 },
    tags: { type: [String], default: [] },
}, { timestamps: true });
journalSchema.index({ user: 1, date: -1 });
export const JournalModel = model('Journal', journalSchema);
//# sourceMappingURL=wellbeing.js.map