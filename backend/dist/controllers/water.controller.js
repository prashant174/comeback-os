import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { WaterLogModel } from '../models/WaterLog.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { waterForDay, waterHistory } from '../services/water.service.js';
import { userToday } from '../services/userContext.service.js';
import { lastNDays } from '../utils/date.js';
const targetFor = async (uid) => (await UserProfileModel.findOne({ user: uid }).select('targets.waterMl').lean())?.targets?.waterMl ?? 0;
export const day = asyncHandler(async (req, res) => {
    const date = req.query.date ?? (await userToday(req.user.id));
    ok(res, { ...(await waterForDay(req.user.id, date)), targetMl: await targetFor(req.user.id) });
});
export const add = asyncHandler(async (req, res) => {
    const date = req.body.date ?? (await userToday(req.user.id));
    const entry = await WaterLogModel.create({ user: req.user.id, date, amountMl: req.body.amountMl });
    created(res, entry);
});
export const remove = asyncHandler(async (req, res) => {
    const r = await WaterLogModel.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!r.deletedCount)
        throw ApiError.notFound('Entry not found');
    ok(res, { deleted: true });
});
export const history = asyncHandler(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    const today = await userToday(req.user.id);
    const rows = await waterHistory(req.user.id, lastNDays(today, days));
    ok(res, rows, { targetMl: await targetFor(req.user.id) });
});
//# sourceMappingURL=water.controller.js.map