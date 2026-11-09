import { Router } from 'express';
import * as c from '../controllers/settings.controller.js';
import { validate } from '../middleware/validate.js';
import * as v from '../validators/settings.validators.js';

import { imageUpload } from '../middleware/upload.js';
import { deleteImage, saveImage, sendImage } from '../services/files.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { UserPreferenceModel } from '../models/UserPreference.js';
import { UserModel } from '../models/User.js';

const r = Router();
r.get('/', c.getSettings);
r.patch('/profile', validate({ body: v.profileUpdateSchema }), c.updateProfile);
r.patch('/preferences', validate({ body: v.preferencesUpdateSchema }), c.updatePreferences);
r.post('/reset', validate({ body: v.resetSchema }), c.resetToDefault);

/* ---- profile photo ---- */

r.post('/avatar', imageUpload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Attach an image in the "avatar" field');
  const ref = await saveImage(req.file, req.user!.id);
  const prev = await UserPreferenceModel.findOneAndUpdate({ user: req.user!.id }, { avatarFile: ref }).lean();
  await deleteImage(prev?.avatarFile);
  const user = await UserModel.findByIdAndUpdate(req.user!.id, { avatarUrl: `/api/settings/avatar?v=${Date.now()}` }, { new: true });
  ok(res, user);
}));
r.get('/avatar', asyncHandler(async (req, res) => {
  const p = await UserPreferenceModel.findOne({ user: req.user!.id }).select('avatarFile').lean();
  if (!p?.avatarFile) throw ApiError.notFound('No profile photo');
  await sendImage(p.avatarFile, res);
}));
r.delete('/avatar', asyncHandler(async (req, res) => {
  const prev = await UserPreferenceModel.findOneAndUpdate({ user: req.user!.id }, { avatarFile: null }).lean();
  await deleteImage(prev?.avatarFile);
  ok(res, await UserModel.findByIdAndUpdate(req.user!.id, { avatarUrl: null }, { new: true }));
}));

export default r;
