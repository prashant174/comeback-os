import type { RequestHandler } from 'express';
import { ensureModuleSeeds } from '../services/seed.service.js';

/** Lazily seeds starter data for modules the user hasn't used yet (cached per process). */
export const ensureSeeded: RequestHandler = (req, _res, next) => {
  if (!req.user) return next();
  ensureModuleSeeds(req.user.id).then(() => next(), next);
};
