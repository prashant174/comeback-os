import type { Types } from 'mongoose';
import {
  DEFAULT_CAREER_GOALS, DEFAULT_DASHBOARD_WIDGETS, DEFAULT_HABITS,
  DEFAULT_PROFILE, DEFAULT_SCHEDULE, DEFAULT_TARGETS,
} from '../config/defaults.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { UserPreferenceModel } from '../models/UserPreference.js';
import { HabitModel } from '../models/Habit.js';
import { ensureModuleSeeds } from './seed.service.js';

type Id = string | Types.ObjectId;

export const defaultProfileDoc = () => ({
  personal: { ...DEFAULT_PROFILE, equipment: [...DEFAULT_PROFILE.equipment] },
  targets: { ...DEFAULT_TARGETS },
  schedule: { ...DEFAULT_SCHEDULE, blocks: DEFAULT_SCHEDULE.blocks.map((b) => ({ ...b })) },
  careerGoals: [...DEFAULT_CAREER_GOALS],
});

export const defaultPreferenceDoc = () => ({
  theme: 'system' as const,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w })),
  waterQuickAdd: [150, 250, 500],
  weekStartsOn: 1,
});

/** Called once at registration: seeds profile, preferences and default habits. */
export async function provisionNewUser(userId: Id) {
  await UserProfileModel.create({ user: userId, ...defaultProfileDoc() });
  await UserPreferenceModel.create({ user: userId, ...defaultPreferenceDoc() });
  await HabitModel.insertMany(DEFAULT_HABITS.map((h, i) => ({ ...h, user: userId, order: i })));
  await ensureModuleSeeds(String(userId));
}

/** Lazily repairs missing docs (e.g. user created by older version / manual DB edits). */
export async function ensureUserDocs(userId: Id) {
  const [profile, prefs] = await Promise.all([
    UserProfileModel.findOne({ user: userId }),
    UserPreferenceModel.findOne({ user: userId }),
  ]);
  const p = prefs ?? (await UserPreferenceModel.create({ user: userId, ...defaultPreferenceDoc() }));
  // New widgets shipped since this user's layout was saved → adopt the new default
  // layout, keeping the user's show/hide choices for widgets they already had.
  const have = new Map(p.dashboardWidgets.map((w) => [w.key, w]));
  if (DEFAULT_DASHBOARD_WIDGETS.some((w) => !have.has(w.key))) {
    p.set('dashboardWidgets', DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w, visible: have.get(w.key)?.visible ?? w.visible })));
    await p.save();
  }
  return {
    profile: profile ?? (await UserProfileModel.create({ user: userId, ...defaultProfileDoc() })),
    prefs: p,
  };
}
