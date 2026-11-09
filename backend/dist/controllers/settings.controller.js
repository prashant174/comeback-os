import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { UserPreferenceModel } from '../models/UserPreference.js';
import { HabitModel } from '../models/Habit.js';
import { DEFAULT_HABITS } from '../config/defaults.js';
import { defaultPreferenceDoc, defaultProfileDoc, ensureUserDocs } from '../services/userSetup.service.js';
/** Flattens nested partial updates to dot-paths so unspecified fields are preserved. */
function toSet(obj, prefix = '') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v))
            Object.assign(out, toSet(v, path));
        else
            out[path] = v;
    }
    return out;
}
export const getSettings = asyncHandler(async (req, res) => {
    const { profile, prefs } = await ensureUserDocs(req.user.id);
    ok(res, { profile, preferences: prefs });
});
export const updateProfile = asyncHandler(async (req, res) => {
    await ensureUserDocs(req.user.id);
    const profile = await UserProfileModel.findOneAndUpdate({ user: req.user.id }, { $set: toSet(req.body) }, { new: true, runValidators: true });
    ok(res, profile);
});
export const updatePreferences = asyncHandler(async (req, res) => {
    await ensureUserDocs(req.user.id);
    const prefs = await UserPreferenceModel.findOneAndUpdate({ user: req.user.id }, { $set: req.body }, { new: true, runValidators: true });
    ok(res, prefs);
});
export const resetToDefault = asyncHandler(async (req, res) => {
    const uid = req.user.id;
    const { section } = req.body;
    if (section === 'profile' || section === 'all') {
        await UserProfileModel.findOneAndUpdate({ user: uid }, { $set: defaultProfileDoc() }, { upsert: true });
    }
    if (section === 'preferences' || section === 'all') {
        await UserPreferenceModel.findOneAndUpdate({ user: uid }, { $set: defaultPreferenceDoc() }, { upsert: true });
    }
    if (section === 'habits' || section === 'all') {
        // Soft-delete current habits (logs kept for history), then re-seed defaults.
        await HabitModel.updateMany({ user: uid, deletedAt: null }, { deletedAt: new Date() });
        await HabitModel.insertMany(DEFAULT_HABITS.map((h, i) => ({ ...h, user: uid, order: i })));
    }
    const { profile, prefs } = await ensureUserDocs(uid);
    ok(res, { profile, preferences: prefs });
});
//# sourceMappingURL=settings.controller.js.map