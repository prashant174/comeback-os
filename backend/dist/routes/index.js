import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAdmin, requireAuth, requireMember } from '../middleware/auth.js';
import adminRoutes from './admin.routes.js';
import { ensureSeeded } from '../middleware/seed.js';
import authRoutes from './auth.routes.js';
import settingsRoutes from './settings.routes.js';
import habitRoutes from './habit.routes.js';
import waterRoutes from './water.routes.js';
import routineRoutes from './routine.routes.js';
import fitnessRoutes from './fitness.routes.js';
import nutritionRoutes from './nutrition.routes.js';
import learningRoutes from './learning.routes.js';
import financeRoutes from './finance.routes.js';
import groomingRoutes from './grooming.routes.js';
import analyticsRoutes from './analytics.routes.js';
import { sleepRouter, goalsRouter, journalRouter } from './wellbeing.routes.js';
import { remindersRouter, notificationsRouter } from './notify.routes.js';
import { summary } from '../controllers/dashboard.controller.js';
const api = Router();
api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', db: mongoose.connection.readyState === 1 ? 'up' : 'down' } }));
api.use('/auth', authRoutes);
// Only known module prefixes require login (so unknown /api paths still 404).
// Each also lazily seeds starter data for modules the user hasn't used yet.
const PROTECTED = ['/settings', '/habits', '/water', '/dashboard', '/routines', '/fitness', '/nutrition', '/learning',
    '/finance', '/grooming', '/sleep', '/goals', '/journal', '/reminders', '/notifications', '/analytics'];
api.use(PROTECTED, requireAuth, requireMember, ensureSeeded);
api.use('/admin', requireAuth, requireAdmin, adminRoutes);
const authed = Router();
authed.use('/settings', settingsRoutes);
authed.use('/habits', habitRoutes);
authed.use('/water', waterRoutes);
authed.get('/dashboard', summary);
authed.use('/routines', routineRoutes);
authed.use('/fitness', fitnessRoutes);
authed.use('/nutrition', nutritionRoutes);
authed.use('/learning', learningRoutes);
authed.use('/finance', financeRoutes);
authed.use('/grooming', groomingRoutes);
authed.use('/sleep', sleepRouter);
authed.use('/goals', goalsRouter);
authed.use('/journal', journalRouter);
authed.use('/reminders', remindersRouter);
authed.use('/notifications', notificationsRouter);
authed.use('/analytics', analyticsRoutes);
api.use(authed);
export default api;
//# sourceMappingURL=index.js.map