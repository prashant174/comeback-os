import { Types } from 'mongoose';
import { UserPreferenceModel } from '../models/UserPreference.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { RoutineModel } from '../models/routine.js';
import { ExerciseModel, WorkoutPlanModel } from '../models/fitness.js';
import { FoodModel, MealPlanModel } from '../models/nutrition.js';
import { LearningPathModel, ProjectModel } from '../models/learning.js';
import { BudgetModel } from '../models/finance.js';
import { GroomingTaskModel } from '../models/grooming.js';
import { GoalModel } from '../models/wellbeing.js';
import { ReminderModel } from '../models/notify.js';
import * as S from '../config/seeds.js';
import { dayKey, shiftDay } from '../utils/date.js';

type Seeder = (userId: Types.ObjectId, today: string) => Promise<void>;

const seeders: Record<string, Seeder> = {
  routines: async (user) => {
    const profile = await UserProfileModel.findOne({ user }).lean();
    const wake = profile?.schedule?.wakeUp ?? '06:15';
    const sleep = profile?.schedule?.sleep ?? '23:00';
    const add = (t: string, m: number) => { const [h, mm] = t.split(':').map(Number); const x = (h * 60 + mm + m) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
    const weekday = [
      { title: 'Wake up', start: wake, end: add(wake, 10), category: 'routine', priority: 'medium' },
      ...(profile?.schedule?.blocks ?? []).map((b) => ({ title: b.label, start: b.start, end: b.end, category: b.key, priority: ['workout', 'learning'].includes(b.key) ? 'high' : 'medium' })),
      { title: 'Sleep', start: sleep, end: add(sleep, 10), category: 'sleep', priority: 'high' },
    ];
    await RoutineModel.insertMany([
      { user, name: 'Weekdays', days: [1, 2, 3, 4, 5], activities: weekday, order: 0 },
      { user, name: 'Saturday', days: [6], activities: S.WEEKEND_ROUTINES.saturday, order: 1 },
      { user, name: 'Sunday', days: [0], activities: S.WEEKEND_ROUTINES.sunday, order: 2 },
    ]);
  },
  fitness: async (user) => {
    const exercises = await ExerciseModel.insertMany(S.SEED_EXERCISES.map((e) => ({ ...e, user })));
    const byName = new Map<string, Types.ObjectId>(exercises.map((e) => [String(e.name), e._id as Types.ObjectId]));
    await WorkoutPlanModel.insertMany(S.SEED_WORKOUT_PLAN.map((p) => ({
      user, dayOfWeek: p.dayOfWeek, title: p.title, focus: p.focus,
      items: p.items.map((i) => ({ exercise: byName.get(i.name) ?? null, name: i.name, sets: i.sets, reps: i.reps ?? 0, durationSec: i.durationSec ?? 0, restSec: i.restSec ?? 60 })),
    })));
  },
  nutrition: async (user) => {
    const foods = await FoodModel.insertMany(S.SEED_FOODS.map((f) => ({ ...f, user })));
    const byName = new Map(foods.map((f) => [f.name, f._id]));
    await MealPlanModel.insertMany(Object.entries(S.SEED_MEAL_PLAN).map(([dow, meals]) => ({
      user, dayOfWeek: Number(dow),
      items: Object.entries(meals).flatMap(([mealType, list]) => list.map(([foodName, quantityG]) => ({ mealType, food: byName.get(foodName)!, foodName, quantityG }))),
    })));
  },
  learning: async (user, today) => {
    await LearningPathModel.insertMany(S.SEED_LEARNING_PATHS.map((p, i) => ({
      user, title: p.title, description: p.description, order: i,
      startDate: shiftDay(today, i * 30), targetDate: shiftDay(today, i * 30 + 29),
      topics: p.topics.map((title) => ({ title })), resources: p.resources,
    })));
    await ProjectModel.insertMany(S.SEED_PROJECTS.map((p) => ({ ...p, user })));
  },
  finance: async (user) => {
    await BudgetModel.updateOne({ user }, { $setOnInsert: { user, categories: S.SEED_BUDGET } }, { upsert: true });
  },
  grooming: async (user) => {
    await GroomingTaskModel.insertMany(S.SEED_GROOMING.map((t, i) => ({ ...t, daysOfWeek: 'daysOfWeek' in t ? [...t.daysOfWeek] : [0], user, order: i })));
  },
  goals: async (user, today) => {
    await GoalModel.insertMany(S.SEED_GOALS.map((g) => ({
      user, title: g.title, category: g.category, horizon: 90, startDate: today, deadline: shiftDay(today, 90),
      priority: 'high', milestones: g.milestones.map((title) => ({ title })),
    })));
  },
  reminders: async (user) => {
    await ReminderModel.insertMany(S.SEED_REMINDERS.map((r) => ({ ...r, days: 'days' in r ? [...r.days] : [0, 1, 2, 3, 4, 5, 6], user })));
  },
};

export const SEEDED_MODULES = Object.keys(seeders);
const done = new Set<string>(); // per-process cache: userId

const inflight = new Map<string, Promise<void>>();

/**
 * Idempotently seeds any module this user hasn't been seeded for yet.
 * Each module is *claimed* atomically before seeding, so parallel requests
 * (or multiple processes) can never seed the same module twice.
 */
export function ensureModuleSeeds(userId: string): Promise<void> {
  if (done.has(userId)) return Promise.resolve();
  const running = inflight.get(userId);
  if (running) return running;
  const p = (async () => {
    const prefs = await UserPreferenceModel.findOne({ user: userId }).select('seededModules').lean();
    if (!prefs) return; // provisioning not finished; retry next request
    const missing = SEEDED_MODULES.filter((m) => !prefs.seededModules?.includes(m));
    if (missing.length) {
      const profile = await UserProfileModel.findOne({ user: userId }).select('personal.timezone').lean();
      const today = dayKey(new Date(), profile?.personal?.timezone || 'Asia/Kolkata');
      const uid = new Types.ObjectId(userId);
      for (const m of missing) {
        const claim = await UserPreferenceModel.updateOne({ user: userId, seededModules: { $ne: m } }, { $addToSet: { seededModules: m } });
        if (!claim.modifiedCount) continue; // someone else claimed it
        try {
          await seeders[m](uid, today);
        } catch (e) {
          await UserPreferenceModel.updateOne({ user: userId }, { $pull: { seededModules: m } });
          throw e;
        }
      }
    }
    done.add(userId);
  })().finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}

export const _resetSeedCache = () => done.clear();
