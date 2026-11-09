import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { HabitModel } from '../models/Habit.js';
import { dailyCompletion, listHabitsWithStatus, setHabitCompletion } from '../services/habit.service.js';
import { userToday } from '../services/userContext.service.js';
import { lastNDays } from '../utils/date.js';

async function ownedHabit(userId: string, id: string) {
  const habit = await HabitModel.findOne({ _id: id, user: userId, deletedAt: null });
  if (!habit) throw ApiError.notFound('Habit not found');
  return habit;
}

export const list = asyncHandler(async (req, res) => {
  const q = req.query as { includeArchived?: string; date?: string };
  const date = q.date ?? (await userToday(req.user!.id));
  ok(res, await listHabitsWithStatus(req.user!.id, date, q.includeArchived === 'true'), { date });
});

export const create = asyncHandler(async (req, res) => {
  const last = await HabitModel.findOne({ user: req.user!.id, deletedAt: null }).sort({ order: -1 }).select('order');
  const habit = await HabitModel.create({ ...req.body, user: req.user!.id, order: (last?.order ?? -1) + 1 });
  created(res, habit);
});

export const update = asyncHandler(async (req, res) => {
  const habit = await ownedHabit(req.user!.id, req.params.id);
  habit.set(req.body);
  await habit.save();
  ok(res, habit);
});

export const remove = asyncHandler(async (req, res) => {
  const habit = await ownedHabit(req.user!.id, req.params.id);
  habit.deletedAt = new Date();
  await habit.save();
  ok(res, { deleted: true });
});

export const toggle = asyncHandler(async (req, res) => {
  await ownedHabit(req.user!.id, req.params.id);
  const date = req.body.date ?? (await userToday(req.user!.id));
  await setHabitCompletion(req.user!.id, req.params.id, date, req.body.completed);
  ok(res, { habit: req.params.id, date, completed: req.body.completed });
});

export const reorder = asyncHandler(async (req, res) => {
  const ids: string[] = req.body.ids;
  const count = await HabitModel.countDocuments({ _id: { $in: ids }, user: req.user!.id, deletedAt: null });
  if (count !== ids.length) throw ApiError.badRequest('One or more habits not found');
  await HabitModel.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, user: req.user!.id }, update: { order: i } } })));
  ok(res, { reordered: true });
});

export const heatmap = asyncHandler(async (req, res) => {
  const days = Number((req.query as { days?: number }).days ?? 90);
  const today = await userToday(req.user!.id);
  ok(res, await dailyCompletion(req.user!.id, lastNDays(today, days)));
});
