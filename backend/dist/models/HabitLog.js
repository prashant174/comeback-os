import { Schema, model, Types } from 'mongoose';
/** One document per (habit, day). Existence + completed=true means done. */
const habitLogSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    habit: { type: Types.ObjectId, ref: 'Habit', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    completed: { type: Boolean, default: true },
    note: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });
habitLogSchema.index({ habit: 1, date: 1 }, { unique: true });
habitLogSchema.index({ user: 1, date: 1 });
export const HabitLogModel = model('HabitLog', habitLogSchema);
//# sourceMappingURL=HabitLog.js.map