import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { UserModel } from '../models/User.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(ApiError.unauthorized('Missing access token'));
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired access token'));
  }
};

/** Admin routes re-check the database, so a demoted/disabled admin loses access immediately. */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.user?.role !== 'admin') return next(ApiError.forbidden('Admin only'));
  UserModel.findById(req.user.id).select('role isActive').lean()
    .then((u) => (u && u.role === 'admin' && u.isActive ? next() : next(ApiError.forbidden('Admin only'))), next);
};

/** Tracking modules are for regular users; the admin account only uses /api/admin. */
export const requireMember: RequestHandler = (req, _res, next) => {
  if (req.user?.role === 'admin') return next(ApiError.forbidden('The admin account has no personal tracker. Log in with a regular account.'));
  next();
};
