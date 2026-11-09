import { Router } from 'express';
import { z } from 'zod';
import { FoodModel, MealEntryModel, MealPlanModel, MEAL_TYPES } from '../models/nutrition.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { buildEntry, groceryList, nutritionDay, nutritionSeries } from '../services/nutrition.service.js';
import { lastNDays } from '../utils/date.js';
const r = Router();
const m = (max) => z.number().min(0).max(max);
const foodBody = z.object({
    name: z.string().trim().min(1).max(80),
    category: z.string().max(30).default('other'),
    per100g: z.object({ kcal: m(1000), protein: m(100), carbs: m(100), fat: m(100), fiber: m(100) }),
    unitName: z.string().max(20).default(''),
    gramsPerUnit: z.number().min(0).max(2000).default(0),
    verified: z.boolean().default(false),
    source: z.string().max(160).default('Added by you'),
});
r.use('/foods', crudRouter({ model: FoodModel, create: foodBody, searchFields: ['name', 'category'], filters: ['category'], sort: { name: 1 }, softDelete: true, maxLimit: 500 }));
const entryBody = z.object({
    date: dayKeySchema,
    mealType: z.enum(MEAL_TYPES),
    food: objectId,
    quantityG: z.number().min(1).max(5000),
});
r.use('/entries', crudRouter({
    model: MealEntryModel, create: entryBody, dateField: 'date', sort: { date: -1, createdAt: 1 },
    transform: async (body, req, existing) => {
        const food = body.food ?? String(existing?.food);
        const qty = body.quantityG ?? existing?.quantityG;
        return { ...body, ...(await buildEntry(req.user.id, food, qty)) };
    },
}));
r.get('/day', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
    const date = req.query.date ?? (await userToday(req.user.id));
    ok(res, await nutritionDay(req.user.id, date));
}));
r.get('/series', validate({ query: z.object({ days: z.coerce.number().int().min(1).max(366).default(7) }) }), asyncHandler(async (req, res) => {
    const today = await userToday(req.user.id);
    ok(res, await nutritionSeries(req.user.id, lastNDays(today, Number(req.query.days ?? 7))));
}));
/* ---- weekly meal plan ---- */
r.get('/plan', asyncHandler(async (req, res) => ok(res, await MealPlanModel.find({ user: req.user.id }).sort({ dayOfWeek: 1 }).lean())));
r.put('/plan/:dayOfWeek', validate({
    params: z.object({ dayOfWeek: z.coerce.number().int().min(0).max(6) }),
    body: z.object({ items: z.array(z.object({ mealType: z.enum(MEAL_TYPES), food: objectId, quantityG: z.number().min(1).max(5000) })).max(60) }),
}), asyncHandler(async (req, res) => {
    const items = await Promise.all(req.body.items.map(async (it) => {
        const e = await buildEntry(req.user.id, it.food, it.quantityG);
        return { mealType: it.mealType, food: e.food, foodName: e.foodName, quantityG: it.quantityG };
    }));
    const plan = await MealPlanModel.findOneAndUpdate({ user: req.user.id, dayOfWeek: req.params.dayOfWeek }, { $set: { items } }, { new: true, upsert: true });
    ok(res, plan);
}));
/** Copy a plan day into the meal log for a date (optionally a single meal). */
r.post('/plan/:dayOfWeek/apply', validate({
    params: z.object({ dayOfWeek: z.coerce.number().int().min(0).max(6) }),
    body: z.object({ date: dayKeySchema, mealType: z.enum(MEAL_TYPES).optional() }),
}), asyncHandler(async (req, res) => {
    const plan = await MealPlanModel.findOne({ user: req.user.id, dayOfWeek: req.params.dayOfWeek }).lean();
    const items = (plan?.items ?? []).filter((i) => !req.body.mealType || i.mealType === req.body.mealType);
    const docs = await Promise.all(items.map(async (i) => ({
        user: req.user.id, date: req.body.date, mealType: i.mealType, ...(await buildEntry(req.user.id, String(i.food), i.quantityG)),
    })));
    created(res, await MealEntryModel.insertMany(docs));
}));
r.get('/grocery', asyncHandler(async (req, res) => ok(res, await groceryList(req.user.id))));
export default r;
//# sourceMappingURL=nutrition.routes.js.map