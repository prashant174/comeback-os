import { Schema, model, Types } from 'mongoose';

const waterLogSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    amountMl: { type: Number, required: true, min: 1, max: 5000 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

waterLogSchema.index({ user: 1, date: 1 });

export const WaterLogModel = model('WaterLog', waterLogSchema);
