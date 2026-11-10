import { Schema, model, Types } from 'mongoose';

/** Singleton app-wide settings the admin can change at runtime (key = 'app'). */
const appSettingSchema = new Schema(
  {
    key: { type: String, default: 'app', unique: true },
    /** null = follow the ALLOW_REGISTRATION env var */
    registrationOpen: { type: Boolean, default: null },
    announcement: {
      text: { type: String, default: '', maxlength: 300 },
      tone: { type: String, enum: ['info', 'warning'], default: 'info' },
      active: { type: Boolean, default: false },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);
export const AppSettingModel = model('AppSetting', appSettingSchema);

/** Every admin action is recorded (who, what, on whom). */
const adminAuditSchema = new Schema(
  {
    admin: { type: Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 60 },
    targetUser: { type: Types.ObjectId, ref: 'User', default: null },
    targetEmail: { type: String, default: null },
    details: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
adminAuditSchema.index({ createdAt: -1 });
// keep a year of audit history
adminAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 86400 });
export const AdminAuditModel = model('AdminAudit', adminAuditSchema);

/** Feedback / bug reports from testers, reviewed in the admin panel. */
const feedbackSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['bug', 'idea', 'other'], default: 'bug' },
    message: { type: String, required: true, maxlength: 2000 },
    page: { type: String, default: '', maxlength: 200 },
    userAgent: { type: String, default: '', maxlength: 300 },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    adminNote: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);
feedbackSchema.index({ status: 1, createdAt: -1 });
export const FeedbackModel = model('Feedback', feedbackSchema);
