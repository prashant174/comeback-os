import { Types } from 'mongoose';
import { FoodModel, MealEntryModel, MealPlanModel, MEAL_TYPES } from '../models/nutrition.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { ApiError } from '../utils/ApiError.js';
import { round1 } from '../utils/timeCore.js';

type Macros = { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
const zero = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
const add = (a: Macros, b: Partial<Macros>) => { for (const k of Object.keys(a) as (keyof Macros)[]) a[k] += b[k] ?? 0; return a; };
const roundAll = (m: Macros): Macros => ({ kcal: Math.round(m.kcal), protein: round1(m.protein), carbs: round1(m.carbs), fat: round1(m.fat), fiber: round1(m.fiber) });

export function macrosFor(per100g: Partial<Macros> | undefined, grams: number): Macros {
  const f = grams / 100;
  return roundAll({ kcal: (per100g?.kcal ?? 0) * f, protein: (per100g?.protein ?? 0) * f, carbs: (per100g?.carbs ?? 0) * f, fat: (per100g?.fat ?? 0) * f, fiber: (per100g?.fiber ?? 0) * f });
}

/** Resolves the food (must belong to the user) and computes the macro snapshot for an entry. */
export async function buildEntry(userId: string, foodId: string, quantityG: number) {
  const food = await FoodModel.findOne({ _id: foodId, user: userId, deletedAt: null }).lean();
  if (!food) throw ApiError.badRequest('Food not found in your food list');
  return { food: food._id, foodName: food.name, quantityG, estimated: !food.verified, macros: macrosFor(food.per100g ?? undefined, quantityG) };
}

export async function nutritionDay(userId: string, date: string) {
  const [entries, profile] = await Promise.all([
    MealEntryModel.find({ user: userId, date }).sort({ createdAt: 1 }).lean(),
    UserProfileModel.findOne({ user: userId }).select('targets').lean(),
  ]);
  const meals = Object.fromEntries(MEAL_TYPES.map((m) => [m, { entries: [] as typeof entries, totals: zero() }]));
  const totals = zero();
  for (const e of entries) {
    meals[e.mealType].entries.push(e);
    add(meals[e.mealType].totals, e.macros as Macros);
    add(totals, e.macros as Macros);
  }
  for (const m of MEAL_TYPES) meals[m].totals = roundAll(meals[m].totals);
  return {
    date, meals, totals: roundAll(totals),
    hasEstimates: entries.some((e) => e.estimated),
    targets: { proteinMinG: profile?.targets?.proteinMinG ?? 0, proteinMaxG: profile?.targets?.proteinMaxG ?? 0 },
  };
}

export async function nutritionSeries(userId: string, days: string[]) {
  const rows = await MealEntryModel.aggregate<{ _id: string } & Macros>([
    { $match: { user: new Types.ObjectId(userId), date: { $gte: days[0], $lte: days[days.length - 1] } } },
    { $group: { _id: '$date', kcal: { $sum: '$macros.kcal' }, protein: { $sum: '$macros.protein' }, carbs: { $sum: '$macros.carbs' }, fat: { $sum: '$macros.fat' }, fiber: { $sum: '$macros.fiber' } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  return days.map((date) => ({ date, ...roundAll(map.get(date) ?? zero()) }));
}

/** Totals of the weekly plan per food → shopping list. */
export async function groceryList(userId: string) {
  const plans = await MealPlanModel.find({ user: userId }).lean();
  const foods = await FoodModel.find({ user: userId }).select('name category unitName gramsPerUnit').lean();
  const fmap = new Map(foods.map((f) => [String(f._id), f]));
  const sum = new Map<string, { food: string; name: string; category: string; grams: number; units: number | null; unitName: string }>();
  for (const p of plans) for (const it of p.items) {
    const f = fmap.get(String(it.food));
    const key = String(it.food);
    const cur = sum.get(key) ?? { food: key, name: it.foodName, category: f?.category ?? 'other', grams: 0, units: null, unitName: f?.unitName ?? '' };
    cur.grams += it.quantityG;
    if (f?.gramsPerUnit) cur.units = Math.ceil(cur.grams / f.gramsPerUnit);
    sum.set(key, cur);
  }
  return [...sum.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
