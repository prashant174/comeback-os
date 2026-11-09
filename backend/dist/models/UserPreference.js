import { Schema, model, Types } from 'mongoose';
const widgetSchema = new Schema({
    key: { type: String, required: true },
    visible: { type: Boolean, default: true },
    size: { type: String, enum: ['sm', 'md', 'lg'], default: 'md' },
}, { _id: false });
const userPreferenceSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    dashboardWidgets: { type: [widgetSchema], default: [] },
    waterQuickAdd: { type: [Number], default: [150, 250, 500] },
    weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
    seededModules: { type: [String], default: [] },
    avatarFile: { type: String, default: null },
}, { timestamps: true });
export const UserPreferenceModel = model('UserPreference', userPreferenceSchema);
//# sourceMappingURL=UserPreference.js.map