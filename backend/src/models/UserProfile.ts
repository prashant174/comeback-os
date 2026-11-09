import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const timeHHMM = { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ };

const scheduleBlockSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true, maxlength: 60 },
    start: { ...timeHHMM, required: true },
    end: { ...timeHHMM, required: true },
  },
  { _id: false },
);

const userProfileSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    personal: {
      ageRange: { type: String, default: null },
      gender: { type: String, default: null },
      heightCm: { type: Number, min: 50, max: 260, default: null },
      currentWeightKg: { type: Number, min: 20, max: 400, default: null },
      fitnessGoal: { type: String, default: null },
      dietType: { type: String, default: null },
      cooking: { type: String, default: null },
      workoutLocation: { type: String, default: null },
      equipment: { type: [String], default: [] },
      currency: { type: String, default: 'INR' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      monthlyBudget: { type: Number, min: 0, default: 0 },
    },
    targets: {
      proteinMinG: { type: Number, min: 0, default: 0 },
      proteinMaxG: { type: Number, min: 0, default: 0 },
      waterMl: { type: Number, min: 0, max: 10000, default: 2500 },
      sleepHours: { type: Number, min: 0, max: 14, default: 8 },
      studyMinutesPerDay: { type: Number, min: 0, max: 1440, default: 0 },
      workoutMinutesPerDay: { type: Number, min: 0, max: 600, default: 0 },
    },
    schedule: {
      wakeUp: { ...timeHHMM, default: '06:00' },
      sleep: { ...timeHHMM, default: '23:00' },
      blocks: { type: [scheduleBlockSchema], default: [] },
    },
    careerGoals: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserProfile = InferSchemaType<typeof userProfileSchema>;
export const UserProfileModel = model('UserProfile', userProfileSchema);
