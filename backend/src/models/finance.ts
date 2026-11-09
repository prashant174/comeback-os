import { Schema, model, Types } from 'mongoose';

const expenseSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    amount: { type: Number, min: 0.01, max: 10_000_000, required: true }, // rupees, 2 decimals
    category: { type: String, required: true, maxlength: 40 },
    note: { type: String, default: '', maxlength: 200 },
    recurring: { type: Boolean, default: false },
    recurringSource: { type: Types.ObjectId, default: null },
  },
  { timestamps: true },
);
expenseSchema.index({ user: 1, date: -1 });
export const ExpenseModel = model('Expense', expenseSchema);

/** The user's monthly budget template (applies to every month). */
const budgetSchema = new Schema(
  {
    user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    categories: {
      type: [{ name: { type: String, required: true, maxlength: 40 }, limit: { type: Number, min: 0, max: 10_000_000, default: 0 }, _id: false }],
      default: [],
    },
    alertAtPct: { type: Number, min: 50, max: 100, default: 90 },
  },
  { timestamps: true },
);
export const BudgetModel = model('Budget', budgetSchema);
