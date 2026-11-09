import { Schema, model, Types } from 'mongoose';

const macros = {
  kcal: { type: Number, min: 0, max: 1000, default: 0 },
  protein: { type: Number, min: 0, max: 100, default: 0 },
  carbs: { type: Number, min: 0, max: 100, default: 0 },
  fat: { type: Number, min: 0, max: 100, default: 0 },
  fiber: { type: Number, min: 0, max: 100, default: 0 },
};

/**
 * Nutrition per 100 g. `verified: false` means the numbers are approximate
 * reference values and should be checked against a pack label / IFCT table.
 */
const foodSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    category: { type: String, default: 'other', maxlength: 30 },
    per100g: macros,
    unitName: { type: String, default: '', maxlength: 20 }, // e.g. "egg", "roti"
    gramsPerUnit: { type: Number, min: 0, max: 2000, default: 0 },
    verified: { type: Boolean, default: false },
    source: { type: String, default: 'user', maxlength: 160 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const FoodModel = model('Food', foodSchema);

const snapshot = {
  kcal: { type: Number, default: 0 }, protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 }, fat: { type: Number, default: 0 }, fiber: { type: Number, default: 0 },
};

export const MEAL_TYPES = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;

const mealEntrySchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    food: { type: Types.ObjectId, ref: 'Food', required: true },
    foodName: { type: String, required: true },
    quantityG: { type: Number, min: 1, max: 5000, required: true },
    estimated: { type: Boolean, default: true },
    macros: snapshot,
  },
  { timestamps: true },
);
mealEntrySchema.index({ user: 1, date: 1 });
export const MealEntryModel = model('MealEntry', mealEntrySchema);

const planItemSchema = new Schema(
  {
    mealType: { type: String, enum: MEAL_TYPES, required: true },
    food: { type: Types.ObjectId, ref: 'Food', required: true },
    foodName: { type: String, required: true },
    quantityG: { type: Number, min: 1, max: 5000, required: true },
  },
  { _id: false },
);
const mealPlanSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    items: { type: [planItemSchema], default: [] },
  },
  { timestamps: true },
);
mealPlanSchema.index({ user: 1, dayOfWeek: 1 }, { unique: true });
export const MealPlanModel = model('MealPlan', mealPlanSchema);
