import { Schema, model, Types } from 'mongoose';
const groomingTaskSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    category: { type: String, enum: ['skincare', 'hair', 'beard', 'dental', 'clothing', 'other'], default: 'other' },
    /** daily | weekly (on daysOfWeek) | interval (every N days since last done) */
    frequency: { type: String, enum: ['daily', 'weekly', 'interval'], default: 'daily' },
    daysOfWeek: { type: [Number], default: [0] },
    intervalDays: { type: Number, min: 1, max: 365, default: 30 },
    order: { type: Number, default: 0 },
}, { timestamps: true });
export const GroomingTaskModel = model('GroomingTask', groomingTaskSchema);
const groomingLogSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    task: { type: Types.ObjectId, ref: 'GroomingTask', required: true },
    date: { type: String, required: true },
}, { timestamps: true });
groomingLogSchema.index({ task: 1, date: 1 }, { unique: true });
groomingLogSchema.index({ user: 1, date: -1 });
export const GroomingLogModel = model('GroomingLog', groomingLogSchema);
const clothingSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    category: { type: String, default: 'top', maxlength: 30 },
    color: { type: String, default: '', maxlength: 30 },
    condition: { type: String, enum: ['new', 'good', 'worn', 'replace'], default: 'good' },
    wishlist: { type: Boolean, default: false },
    price: { type: Number, min: 0, max: 1_000_000, default: 0 },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
}, { timestamps: true });
export const ClothingItemModel = model('ClothingItem', clothingSchema);
const outfitSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    items: { type: [{ type: Types.ObjectId, ref: 'ClothingItem' }], default: [] },
    note: { type: String, default: '', maxlength: 200 },
}, { timestamps: true });
outfitSchema.index({ user: 1, date: 1 });
export const OutfitModel = model('Outfit', outfitSchema);
//# sourceMappingURL=grooming.js.map