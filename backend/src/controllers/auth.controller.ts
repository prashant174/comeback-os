import type { Request, Response, CookieOptions } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import * as auth from '../services/auth.service.js';
import { rotateRefreshToken, revokeRefreshToken, signAccessToken } from '../services/token.service.js';
import { UserModel } from '../models/User.js';
import { env, isProd } from '../config/env.js';
import { getAppSettings, isRegistrationOpen } from '../services/appSettings.service.js';

export const REFRESH_COOKIE = 'cbos_rt';

const cookieOpts = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax',
  path: '/api/auth',
  ...(expires ? { expires } : {}),
});

const ctx = (req: Request) => ({ userAgent: req.get('user-agent'), ip: req.ip });

function sendSession(res: Response, data: { user: unknown; accessToken: string; refresh: { raw: string; expiresAt: Date } }, status = 200) {
  res.cookie(REFRESH_COOKIE, data.refresh.raw, cookieOpts(data.refresh.expiresAt));
  return res.status(status).json({ success: true, data: { user: data.user, accessToken: data.accessToken } });
}

export const config = asyncHandler(async (_req, res) => {
  const count = await UserModel.countDocuments({ role: 'user' });
  const settings = await getAppSettings();
  ok(res, {
    registrationOpen: count === 0 || (await isRegistrationOpen()),
    firstRun: count === 0,
    announcement: settings.announcement?.active && settings.announcement.text ? { text: settings.announcement.text, tone: settings.announcement.tone } : null,
  });
});

export const register = asyncHandler(async (req, res) => {
  sendSession(res, await auth.register(req.body, ctx(req)), 201);
});

export const login = asyncHandler(async (req, res) => {
  sendSession(res, await auth.login(req.body, ctx(req)));
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw ApiError.unauthorized('No refresh token');
  try {
    const rotated = await rotateRefreshToken(raw, ctx(req));
    const user = await UserModel.findById(rotated.userId);
    if (!user || !user.isActive) throw ApiError.unauthorized('Account unavailable');
    const accessToken = signAccessToken({ sub: String(user._id), role: user.role as 'user' | 'admin' });
    sendSession(res, { user, accessToken, refresh: { raw: rotated.raw, expiresAt: rotated.expiresAt } });
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, cookieOpts());
    throw e;
  }
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) await revokeRefreshToken(raw);
  res.clearCookie(REFRESH_COOKIE, cookieOpts());
  ok(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw ApiError.notFound('User not found');
  ok(res, user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await UserModel.findByIdAndUpdate(req.user!.id, { name: req.body.name }, { new: true, runValidators: true });
  ok(res, user);
});

export const changePassword = asyncHandler(async (req, res) => {
  await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
  res.clearCookie(REFRESH_COOKIE, cookieOpts());
  ok(res, { changed: true, message: 'Password changed. Please log in again.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const link = await auth.requestPasswordReset(req.body.email);
  ok(res, {
    message: 'If that email is registered, a reset link has been generated.',
    // Phase 1 has no email provider: expose link only outside production for local use.
    ...(link && !isProd ? { devResetLink: link } : {}),
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  ok(res, { reset: true });
});

