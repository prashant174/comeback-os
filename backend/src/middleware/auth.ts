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

/**
 * Account status cache: a disabled/deleted user loses access on their next
 * request (not when their 15-min access token expires). 30 s TTL keeps the
 * DB cost to ~1 lookup per user per 30 s; admin actions clear it instantly.
 */
const statusCache = new Map<string, { active: boolean; at: number }>();
const STATUS_TTL = 30_000;
export const invalidateUserStatus = (id: string) => statusCache.delete(id);

async function isActiveUser(id: string) {
  const hit = statusCache.get(id);
  if (hit && Date.now() - hit.at < STATUS_TTL) return hit.active;
  const u = await UserModel.findById(id).select('isActive').lean();
  const active = !!u?.isActive;
  statusCache.set(id, { active, at: Date.now() });
  return active;
}

/** Tracking modules are for active regular users; the admin account only uses /api/admin. */
export const requireMember: RequestHandler = (req, _res, next) => {
  if (req.user?.role === 'admin') return next(ApiError.forbidden('The admin account has no personal tracker. Log in with a regular account.'));
  isActiveUser(req.user!.id).then((active) => (active ? next() : next(ApiError.unauthorized('This account is disabled'))), next);
};
