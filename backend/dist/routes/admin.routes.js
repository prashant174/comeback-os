import { Router } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { AdminAuditModel } from '../models/admin.js';
import { AppSettingModel } from '../models/admin.js';
import { NotificationModel } from '../models/notify.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import { revokeAllForUser } from '../services/token.service.js';
import { provisionNewUser } from '../services/userSetup.service.js';
import { getAppSettings } from '../services/appSettings.service.js';
import { activity, audit, deleteUserCompletely, listUsers, overview, setPassword, tempPassword } from '../services/admin.service.js';
import { toCsv } from '../services/export.service.js';
import { env } from '../config/env.js';
import bcrypt from 'bcryptjs';
const r = Router();
const me = (req) => req.user.id;
/** Loads a regular (non-admin) user; admins can't be modified from the panel. */
async function targetUser(id) {
    const u = await UserModel.findById(id);
    if (!u)
        throw ApiError.notFound('User not found');
    if (u.role === 'admin')
        throw ApiError.forbidden('Admin accounts are managed via ADMIN_EMAIL / ADMIN_PASSWORD');
    return u;
}
r.get('/overview', asyncHandler(async (_req, res) => {
    const [o, s] = await Promise.all([overview(), getAppSettings()]);
    ok(res, { ...o, settings: { registrationOpen: s.registrationOpen ?? env.ALLOW_REGISTRATION, registrationSource: s.registrationOpen === null ? 'env' : 'admin', announcement: s.announcement } });
}));
r.get('/activity', validate({ query: z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }) }), asyncHandler(async (req, res) => {
    ok(res, await activity(Number(req.query.days ?? 30)));
}));
r.get('/users', validate({ query: z.object({
        q: z.string().trim().max(100).optional(), status: z.enum(['all', 'active', 'disabled']).default('all'),
        page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
    }) }), asyncHandler(async (req, res) => {
    const q = req.query;
    const { items, total } = await listUsers(q);
    ok(res, items, { total, page: q.page, limit: q.limit });
}));
r.get('/users/export', asyncHandler(async (req, res) => {
    const { items } = await listUsers({ page: 1, limit: 10000, status: 'all' });
    await audit(me(req), 'users.export');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="comeback-users.csv"');
    res.send(toCsv(items, ['name', 'email', 'role', 'isActive', 'createdAt', 'lastLoginAt', 'lastActivityAt', 'entries', 'photos']));
}));
/** Create an account for a friend (works even when public registration is closed). */
r.post('/users', validate({ body: z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email().max(160) }) }), asyncHandler(async (req, res) => {
    if (await UserModel.exists({ email: req.body.email }))
        throw ApiError.conflict('An account with this email already exists');
    const password = tempPassword();
    const u = await UserModel.create({ name: req.body.name, email: req.body.email, role: 'user', passwordHash: await bcrypt.hash(password, 12) });
    await provisionNewUser(u._id);
    await audit(me(req), 'user.create', u);
    created(res, { user: u, tempPassword: password });
}));
r.patch('/users/:id', validate({ params: idParam, body: z.object({ isActive: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() }) }), asyncHandler(async (req, res) => {
    const u = await targetUser(req.params.id);
    const before = { isActive: u.isActive, name: u.name };
    u.set(req.body);
    await u.save();
    if (req.body.isActive === false)
        await revokeAllForUser(String(u._id)); // kick them out now
    await audit(me(req), req.body.isActive === false ? 'user.disable' : req.body.isActive === true ? 'user.enable' : 'user.update', u, { before, after: req.body });
    ok(res, u);
}));
r.post('/users/:id/reset-password', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const u = await targetUser(req.params.id);
    const password = tempPassword();
    await setPassword(String(u._id), password);
    await audit(me(req), 'user.reset_password', u);
    ok(res, { tempPassword: password });
}));
r.post('/users/:id/logout', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const u = await targetUser(req.params.id);
    await revokeAllForUser(String(u._id));
    await audit(me(req), 'user.logout_all', u);
    ok(res, { loggedOut: true });
}));
r.delete('/users/:id', validate({ params: idParam, body: z.object({ confirmEmail: z.string().trim().toLowerCase() }) }), asyncHandler(async (req, res) => {
    const u = await targetUser(req.params.id);
    if (req.body.confirmEmail !== u.email)
        throw ApiError.badRequest('Type the user’s email exactly to confirm deletion');
    const result = await deleteUserCompletely(String(u._id));
    await audit(me(req), 'user.delete', { email: u.email }, result);
    ok(res, { deleted: true, ...result });
}));
r.put('/settings', validate({ body: z.object({
        registrationOpen: z.boolean().nullable().optional(),
        announcement: z.object({ text: z.string().trim().max(300), tone: z.enum(['info', 'warning']), active: z.boolean() }).optional(),
    }) }), asyncHandler(async (req, res) => {
    const set = {};
    if (req.body.registrationOpen !== undefined)
        set.registrationOpen = req.body.registrationOpen;
    if (req.body.announcement)
        set.announcement = { ...req.body.announcement, updatedAt: new Date() };
    const s = await AppSettingModel.findOneAndUpdate({ key: 'app' }, { $set: set }, { upsert: true, new: true });
    await audit(me(req), 'settings.update', null, req.body);
    ok(res, s);
}));
/** In-app notification to every active user. */
r.post('/broadcast', validate({ body: z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().max(500).default('') }) }), asyncHandler(async (req, res) => {
    const users = await UserModel.find({ role: 'user', isActive: true }).select('_id').lean();
    await NotificationModel.insertMany(users.map((u) => ({ user: u._id, title: req.body.title, body: req.body.body, kind: 'announcement' })));
    await audit(me(req), 'broadcast', null, { title: req.body.title, recipients: users.length });
    ok(res, { sent: users.length });
}));
r.get('/audit', validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }) }), asyncHandler(async (req, res) => {
    const rows = await AdminAuditModel.find().sort({ createdAt: -1 }).limit(Number(req.query.limit ?? 50)).populate('admin', 'email').lean();
    ok(res, rows);
}));
export default r;
//# sourceMappingURL=admin.routes.js.map