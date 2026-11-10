import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { app, connectTestDB, resetDB, closeDB, registerUser, auth } from './helpers.js';
import { env } from '../src/config/env.js';
import { ensureAdminAccount } from '../src/services/auth.service.js';
import { _resetSeedCache } from '../src/services/seed.service.js';
import { ReminderModel, NotificationModel } from '../src/models/notify.js';
import { runRemindersTick } from '../src/jobs/reminders.job.js';
import { dayKey, shiftDay, weekdayOf } from '../src/utils/date.js';
import { nowIn } from '../src/utils/time.js';

const ADMIN = { email: 'admin@cbos.dev', password: 'AdminPassw0rd!!' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const today = () => dayKey(new Date(), 'Asia/Kolkata');

beforeAll(connectTestDB);
beforeEach(async () => { await resetDB(); _resetSeedCache(); env.ADMIN_EMAIL = ADMIN.email; env.ADMIN_PASSWORD = ADMIN.password; });
afterAll(async () => { env.ADMIN_EMAIL = undefined; env.ADMIN_PASSWORD = undefined; await closeDB(); });

async function adminToken() {
  await ensureAdminAccount();
  const r = await request(app).post('/api/auth/login').send(ADMIN);
  return r.body.data.accessToken as string;
}

describe('admin account', () => {
  it('is created from env, rotates password, and has no tracker access', async () => {
    const tok = await adminToken();
    expect(tok).toBeTruthy();
    const me = await request(app).get('/api/auth/me').set(auth(tok));
    expect(me.body.data.role).toBe('admin');
    expect((await request(app).get('/api/dashboard').set(auth(tok))).status).toBe(403);

    env.ADMIN_PASSWORD = 'AnotherAdminPass99';
    await ensureAdminAccount();
    expect((await request(app).post('/api/auth/login').send(ADMIN)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'AnotherAdminPass99' })).status).toBe(200);
  });

  it('turns a legacy first-user admin back into a regular user with tracker access', async () => {
    const legacy = await registerUser({ name: 'Prashant' });
    const { UserModel } = await import('../src/models/User.js');
    await UserModel.updateOne({ _id: legacy.res.body.data.user._id }, { role: 'admin' });
    await ensureAdminAccount();
    expect((await UserModel.findById(legacy.res.body.data.user._id))!.role).toBe('user');
    const login = await request(app).post('/api/auth/login').send({ email: legacy.body.email, password: legacy.body.password });
    expect((await request(app).get('/api/dashboard').set(auth(login.body.data.accessToken))).status).toBe(200);
    expect((await UserModel.findOne({ email: ADMIN.email }))!.role).toBe('admin');
  });

  it('refuses a weak admin password', async () => {
    env.ADMIN_PASSWORD = 'short1';
    expect(await ensureAdminAccount()).toBeNull();
  });

  it('blocks regular users from admin APIs', async () => {
    const { token } = await registerUser();
    expect((await request(app).get('/api/admin/overview').set(auth(token))).status).toBe(403);
    expect((await request(app).get('/api/admin/users').set(auth(token))).status).toBe(403);
  });
});

describe('admin panel', () => {
  it('overview, user list with usage metadata only, activity', async () => {
    const tok = await adminToken();
    const friend = await registerUser({ name: 'Rahul' });
    await request(app).post('/api/journal').set(auth(friend.token)).send({ date: today(), reflection: 'very private thoughts' });
    await request(app).post('/api/water').set(auth(friend.token)).send({ amountMl: 250 });
    await request(app).post('/api/fitness/photos').set(auth(friend.token)).attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' });

    const o = await request(app).get('/api/admin/overview').set(auth(tok));
    expect(o.status).toBe(200);
    expect(o.body.data.users.total).toBe(1);
    expect(o.body.data.users.activeLast7Days).toBe(1);
    expect(o.body.data.storage.limitBytes).toBe(512 * 1024 * 1024);

    const u = await request(app).get('/api/admin/users').set(auth(tok));
    const row = u.body.data.find((x: { email: string }) => x.email === friend.body.email);
    expect(row.entries).toBe(2);
    expect(row.photos).toBe(1);
    expect(JSON.stringify(u.body)).not.toContain('very private thoughts');

    const a = await request(app).get('/api/admin/activity?days=7').set(auth(tok));
    expect(a.body.data).toHaveLength(7);
    expect(a.body.data[6].activeUsers).toBe(1);
  });

  it('disable → login blocked and sessions revoked; enable again', async () => {
    const tok = await adminToken();
    const f = await registerUser();
    const rt = f.cookie.find((c) => c.startsWith('cbos_rt='))!.split(';')[0];
    const id = f.res.body.data.user._id;
    expect((await request(app).patch(`/api/admin/users/${id}`).set(auth(tok)).send({ isActive: false })).status).toBe(200);
    const login = await request(app).post('/api/auth/login').send({ email: f.body.email, password: f.body.password });
    expect(login.status).toBe(403);
    expect(login.body.error.message).toMatch(/disabled/);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', rt)).status).toBe(401);
    // wrong password still gets the generic message (no account enumeration)
    expect((await request(app).post('/api/auth/login').send({ email: f.body.email, password: 'wrong123x' })).status).toBe(401);
    await request(app).patch(`/api/admin/users/${id}`).set(auth(tok)).send({ isActive: true });
    expect((await request(app).post('/api/auth/login').send({ email: f.body.email, password: f.body.password })).status).toBe(200);
  });

  it('reset password, create friend account, cannot touch admins', async () => {
    const tok = await adminToken();
    const f = await registerUser();
    const r = await request(app).post(`/api/admin/users/${f.res.body.data.user._id}/reset-password`).set(auth(tok));
    expect(r.body.data.tempPassword).toMatch(/^Cb-/);
    expect((await request(app).post('/api/auth/login').send({ email: f.body.email, password: f.body.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: f.body.email, password: r.body.data.tempPassword })).status).toBe(200);

    const c = await request(app).post('/api/admin/users').set(auth(tok)).send({ name: 'Amit', email: 'amit@test.dev' });
    expect(c.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email: 'amit@test.dev', password: c.body.data.tempPassword });
    expect(login.status).toBe(200);
    expect((await request(app).get('/api/habits').set(auth(login.body.data.accessToken))).body.data).toHaveLength(10);

    const adminId = (await request(app).get('/api/auth/me').set(auth(tok))).body.data._id;
    expect((await request(app).patch(`/api/admin/users/${adminId}`).set(auth(tok)).send({ isActive: false })).status).toBe(403);
  });

  it('delete wipes every document and photo of that user only', async () => {
    const tok = await adminToken();
    const a = await registerUser();
    const b = await registerUser();
    await request(app).post('/api/fitness/photos').set(auth(a.token)).attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' });
    const id = a.res.body.data.user._id;
    expect((await request(app).delete(`/api/admin/users/${id}`).set(auth(tok)).send({ confirmEmail: 'wrong@x.dev' })).status).toBe(400);
    const d = await request(app).delete(`/api/admin/users/${id}`).set(auth(tok)).send({ confirmEmail: a.body.email });
    expect(d.status).toBe(200);
    expect(d.body.data.files).toBe(1);
    for (const m of Object.values(mongoose.models)) {
      if (m.schema.path('user')) expect(await m.countDocuments({ user: id })).toBe(0);
    }
    expect((await request(app).get('/api/habits').set(auth(b.token))).body.data).toHaveLength(10); // other user untouched
    const audit = await request(app).get('/api/admin/audit').set(auth(tok));
    expect(audit.body.data[0].action).toBe('user.delete');
  });

  it('registration toggle, announcement and broadcast', async () => {
    const tok = await adminToken();
    const f = await registerUser();
    await request(app).put('/api/admin/settings').set(auth(tok)).send({ registrationOpen: false, announcement: { text: 'New build is live!', tone: 'info', active: true } });
    expect((await registerUser()).res.status).toBe(403);
    const cfg = await request(app).get('/api/auth/config');
    expect(cfg.body.data.registrationOpen).toBe(false);
    expect(cfg.body.data.announcement.text).toBe('New build is live!');
    const b = await request(app).post('/api/admin/broadcast').set(auth(tok)).send({ title: 'Please test Nutrition', body: 'Log one meal today' });
    expect(b.body.data.sent).toBe(1);
    expect(await NotificationModel.countDocuments({ user: f.res.body.data.user._id, title: 'Please test Nutrition' })).toBe(1);
  });
});

describe('leave days', () => {
  it('replaces the weekday routine, shows on dashboard, and can be undone', async () => {
    const { token } = await registerUser();
    const routines = await request(app).get('/api/routines').set(auth(token));
    const leave = routines.body.data.find((r: { name: string }) => r.name === 'Leave day');
    expect(leave.days).toEqual([]);

    const before = await request(app).get('/api/routines/day').set(auth(token));
    expect(before.body.data.override).toBeNull();

    const m = await request(app).post('/api/routines/overrides').set(auth(token)).send({ from: today(), to: shiftDay(today(), 2), type: 'leave', routine: leave._id, note: 'Family function' });
    expect(m.status).toBe(201);
    expect(m.body.data.dates).toHaveLength(3);

    const d = await request(app).get('/api/routines/day').set(auth(token));
    expect(d.body.data.routine.name).toBe('Leave day');
    expect(d.body.data.override.type).toBe('leave');
    const dash = await request(app).get('/api/dashboard').set(auth(token));
    expect(dash.body.data.routine.name).toBe('Leave day');
    expect(dash.body.data.routine.override.note).toBe('Family function');

    // remove just tomorrow, then the whole leave
    await request(app).delete(`/api/routines/overrides/${shiftDay(today(), 1)}`).set(auth(token));
    expect((await request(app).get('/api/routines/overrides').set(auth(token))).body.data).toHaveLength(2);
    await request(app).delete(`/api/routines/overrides/${today()}?group=true`).set(auth(token));
    expect((await request(app).get('/api/routines/overrides').set(auth(token))).body.data).toHaveLength(0);
    const after = await request(app).get('/api/routines/day').set(auth(token));
    expect(after.body.data.routine.name).not.toBe('Leave day');
  });

  it('a free day (no routine) and validation', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/routines/overrides').set(auth(token)).send({ from: today(), to: today(), type: 'holiday', routine: null });
    const d = await request(app).get('/api/routines/day').set(auth(token));
    expect(d.body.data.routine).toBeNull();
    expect(d.body.data.override.type).toBe('holiday');
    expect((await request(app).post('/api/routines/overrides').set(auth(token)).send({ from: today(), to: shiftDay(today(), -1) })).status).toBe(400);
    expect((await request(app).post('/api/routines/overrides').set(auth(token)).send({ from: today(), to: shiftDay(today(), 90) })).status).toBe(400);
  });

  it('reminders marked skipOnLeave stay quiet on leave days', async () => {
    const { token } = await registerUser();
    const { hhmm, weekday } = nowIn('Asia/Kolkata');
    await ReminderModel.deleteMany({});
    await request(app).post('/api/reminders').set(auth(token)).send({ title: 'Alarm', time: hhmm, days: [weekday], skipOnLeave: true });
    await request(app).post('/api/reminders').set(auth(token)).send({ title: 'Drink water', time: hhmm, days: [weekday], skipOnLeave: false });
    await request(app).post('/api/routines/overrides').set(auth(token)).send({ from: today(), to: today(), type: 'leave' });
    expect(await runRemindersTick()).toBe(1);
    expect(await NotificationModel.exists({ title: 'Alarm' })).toBeNull();
    expect(await NotificationModel.exists({ title: 'Drink water' })).toBeTruthy();
  });

  it('existing users get the Leave day routine and wake reminders flagged', async () => {
    const { res, token } = await registerUser();
    const user = res.body.data.user._id;
    const { RoutineModel } = await import('../src/models/routine.js');
    const { UserPreferenceModel } = await import('../src/models/UserPreference.js');
    await RoutineModel.deleteOne({ user, name: 'Leave day' });
    await ReminderModel.updateMany({ user }, { skipOnLeave: false });
    await UserPreferenceModel.updateOne({ user }, { $pull: { seededModules: 'leaveRoutine' } });
    _resetSeedCache();
    await request(app).get('/api/routines').set(auth(token));
    expect(await RoutineModel.countDocuments({ user, name: 'Leave day' })).toBe(1);
    expect(await ReminderModel.countDocuments({ user, type: 'wake', skipOnLeave: true })).toBe(1);
    expect(weekdayOf(today())).toBeGreaterThanOrEqual(0);
  });
});

describe('review fixes', () => {
  it('a disabled user loses access on the next request, not after the token expires', async () => {
    const adminTok = await adminToken();
    const f = await registerUser();
    expect((await request(app).get('/api/dashboard').set(auth(f.token))).status).toBe(200);
    await request(app).patch(`/api/admin/users/${f.res.body.data.user._id}`).set(auth(adminTok)).send({ isActive: false });
    const r = await request(app).get('/api/dashboard').set(auth(f.token)); // same, still-unexpired access token
    expect(r.status).toBe(401);
    expect(r.body.error.message).toMatch(/disabled/);
  });

  it('feedback: testers send, admin reviews and resolves, users see the status', async () => {
    const adminTok = await adminToken();
    const f = await registerUser();
    const bad = await request(app).post('/api/feedback').set(auth(f.token)).send({ message: 'hi' });
    expect(bad.status).toBe(400);
    const sent = await request(app).post('/api/feedback').set(auth(f.token)).send({ type: 'bug', message: 'Water button does nothing on iPhone', page: '/water' });
    expect(sent.status).toBe(201);
    expect((await request(app).post('/api/feedback').set(auth(adminTok)).send({ message: 'admin has no tracker' })).status).toBe(403);
    expect((await request(app).get('/api/admin/feedback').set(auth(f.token))).status).toBe(403);

    const list = await request(app).get('/api/admin/feedback').set(auth(adminTok));
    expect(list.body.meta.open).toBe(1);
    expect(list.body.data[0].user.email).toBe(f.body.email.toLowerCase());
    const id = list.body.data[0]._id;
    await request(app).patch(`/api/admin/feedback/${id}`).set(auth(adminTok)).send({ status: 'resolved', adminNote: 'Fixed in next deploy' });
    const mine = await request(app).get('/api/feedback/mine').set(auth(f.token));
    expect(mine.body.data[0]).toMatchObject({ status: 'resolved', adminNote: 'Fixed in next deploy' });
    expect((await request(app).get('/api/admin/feedback').set(auth(adminTok))).body.meta.open).toBe(0);
  });
});

describe('admin bootstrap with a shared database', () => {
  it('a server without admin config (or with a weak password) never demotes the real admin', async () => {
    await adminToken(); // creates the admin from env
    const { UserModel } = await import('../src/models/User.js');
    const saved = { email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD };
    try {
      env.ADMIN_EMAIL = undefined; env.ADMIN_PASSWORD = undefined; // e.g. Render with no env vars set
      await ensureAdminAccount();
      expect((await UserModel.findOne({ email: ADMIN.email }))!.role).toBe('admin');
      env.ADMIN_EMAIL = 'other@cbos.dev'; env.ADMIN_PASSWORD = 'short1'; // misconfigured server
      await ensureAdminAccount();
      expect((await UserModel.findOne({ email: ADMIN.email }))!.role).toBe('admin');
      expect(await UserModel.exists({ email: 'other@cbos.dev' })).toBeNull();
    } finally {
      env.ADMIN_EMAIL = saved.email; env.ADMIN_PASSWORD = saved.password;
    }
  });
});
