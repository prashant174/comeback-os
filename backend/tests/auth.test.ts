import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDB, resetDB, closeDB, registerUser, auth } from './helpers.js';
import { env } from '../src/config/env.js';
import { HabitModel } from '../src/models/Habit.js';

beforeAll(connectTestDB);
beforeEach(resetDB);
afterAll(closeDB);

const rtCookie = (setCookie: string[]) => setCookie.find((c) => c.startsWith('cbos_rt='))!.split(';')[0];

describe('auth', () => {
  it('registers users as regular users (never admin), seeds defaults, never leaks hash', async () => {
    const { res } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.headers['set-cookie'][0]).toMatch(/cbos_rt=.*HttpOnly/i);
    expect(await HabitModel.countDocuments({ user: res.body.data.user._id })).toBe(10);

    const second = await registerUser();
    expect(second.res.body.data.user.role).toBe('user');
  });

  it('rejects weak password and duplicate email', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'A b', email: 'w@t.dev', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.success).toBe(false);
    const { body } = await registerUser();
    const dup = await request(app).post('/api/auth/register').send(body);
    expect(dup.status).toBe(409);
  });

  it('blocks registration when disabled (after first user)', async () => {
    await registerUser();
    env.ALLOW_REGISTRATION = false;
    try {
      const r = await registerUser();
      expect(r.res.status).toBe(403);
      const cfg = await request(app).get('/api/auth/config');
      expect(cfg.body.data.registrationOpen).toBe(false);
    } finally {
      env.ALLOW_REGISTRATION = true;
    }
  });

  it('logs in, returns same error for bad email and bad password', async () => {
    const { body } = await registerUser();
    const good = await request(app).post('/api/auth/login').send({ email: body.email, password: body.password });
    expect(good.status).toBe(200);
    const badPw = await request(app).post('/api/auth/login').send({ email: body.email, password: 'nope12345' });
    const badEmail = await request(app).post('/api/auth/login').send({ email: 'x@none.dev', password: 'nope12345' });
    expect(badPw.status).toBe(401);
    expect(badEmail.status).toBe(401);
    expect(badPw.body.error.message).toBe(badEmail.body.error.message);
  });

  it('protects routes and rejects bad tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set(auth('garbage'))).status).toBe(401);
    const { token } = await registerUser();
    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toMatch(/@test.dev$/);
  });

  it('rotates refresh tokens and revokes family on reuse', async () => {
    const { cookie } = await registerUser();
    const first = rtCookie(cookie);

    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(r1.status).toBe(200);
    const second = rtCookie(r1.headers['set-cookie'] as unknown as string[]);
    expect(second).not.toBe(first);

    // Reusing the old token → 401 and the whole family is revoked
    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', first);
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app).post('/api/auth/refresh').set('Cookie', second);
    expect(afterReuse.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const { cookie } = await registerUser();
    const c = rtCookie(cookie);
    expect((await request(app).post('/api/auth/logout').set('Cookie', c)).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c)).status).toBe(401);
  });

  it('forgot + reset password flow', async () => {
    const { body } = await registerUser();
    const f = await request(app).post('/api/auth/forgot-password').send({ email: body.email });
    expect(f.status).toBe(200);
    const token = new URL(f.body.data.devResetLink).searchParams.get('token')!;
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@test.dev' });
    expect(unknown.body.data.devResetLink).toBeUndefined();

    const r = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassw0rd' });
    expect(r.status).toBe(200);
    const again = await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPassw0rd' });
    expect(again.status).toBe(400);
    const login = await request(app).post('/api/auth/login').send({ email: body.email, password: 'NewPassw0rd' });
    expect(login.status).toBe(200);
  });

  it('change password requires correct current password', async () => {
    const { token, body } = await registerUser();
    const bad = await request(app).post('/api/auth/change-password').set(auth(token)).send({ currentPassword: 'wrong', newPassword: 'Another1pass' });
    expect(bad.status).toBe(400);
    const good = await request(app).post('/api/auth/change-password').set(auth(token)).send({ currentPassword: body.password, newPassword: 'Another1pass' });
    expect(good.status).toBe(200);
  });
});
