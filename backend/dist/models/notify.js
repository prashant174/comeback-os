import { Schema, model, Types } from 'mongoose';
const reminderSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    type: { type: String, enum: ['wake', 'workout', 'meal', 'water', 'study', 'sleep', 'review', 'budget', 'other'], default: 'other' },
    time: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    days: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    enabled: { type: Boolean, default: true },
    /** stay quiet on days marked as leave / holiday / sick */
    skipOnLeave: { type: Boolean, default: false },
    lastFiredDate: { type: String, default: null },
}, { timestamps: true });
reminderSchema.index({ enabled: 1, time: 1 });
export const ReminderModel = model('Reminder', reminderSchema);
const notificationSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 500 },
    kind: { type: String, default: 'reminder', maxlength: 30 },
    link: { type: String, default: null },
    dedupeKey: { type: String, default: null },
    readAt: { type: Date, default: null },
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
// auto-clean after 60 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 86400 });
export const NotificationModel = model('Notification', notificationSchema);
//# sourceMappingURL=notify.js.map