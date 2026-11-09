import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDB, resetDB, closeDB, registerUser, auth } from './helpers.js';
import { computeStreaks } from '../src/services/habit.service.js';
import { Types } from 'mongoose';

beforeAll(connectTestDB);
beforeEach(resetDB);
afterAll(closeDB);

describe('settings', () => {
  it('returns seeded defaults and applies partial updates without wiping siblings', async () => {
    const { token } = await registerUser();
    const s = await request(app).get('/api/settings').set(auth(token));
    expect(s.body.data.profile.personal.heightCm).toBe(163);
    expect(s.body.data.profile.targets.proteinMinG).toBe(85);
    expect(s.body.data.profile.schedule.wakeUp).toBe('06:15');

    const u = await request(app).patch('/api/settings/profile').set(auth(token)).send({ personal: { currentWeightKg: 58.5 }, targets: { waterMl: 3500 } });
    expect(u.status).toBe(200);
    expect(u.body.data.personal.currentWeightKg).toBe(58.5);
    expect(u.body.data.personal.heightCm).toBe(163);
    expect(u.body.data.targets.waterMl).toBe(3500);
    expect(u.body.data.targets.proteinMinG).toBe(85);
  });

  it('validates input', async () => {
    const { token } = await registerUser();
    const bad = await request(app).patch('/api/settings/profile').set(auth(token)).send({ schedule: { wakeUp: '25:99' } });
    expect(bad.status).toBe(400);
    const tz = await request(app).patch('/api/settings/profile').set(auth(token)).send({ personal: { timezone: 'Mars/Olympus' } });
    expect(tz.status).toBe(400);
    const protein = await request(app).patch('/api/settings/profile').set(auth(token)).send({ targets: { proteinMinG: 120, proteinMaxG: 90 } });
    expect(protein.status).toBe(400);
  });

  it('strips mongo operators from input', async () => {
    const { token } = await registerUser();
    const r = await request(app).patch('/api/settings/profile').set(auth(token)).send({ personal: { $where: 'x' } });
    expect(r.status).toBe(200);
  });

  it('resets sections to default', async () => {
    const { token } = await registerUser();
    await request(app).patch('/api/settings/profile').set(auth(token)).send({ personal: { heightCm: 170 } });
    await request(app).patch('/api/settings/preferences').set(auth(token)).send({ theme: 'dark' });
    const r = await request(app).post('/api/settings/reset').set(auth(token)).send({ section: 'all' });
    expect(r.body.data.profile.personal.heightCm).toBe(163);
    expect(r.body.data.preferences.theme).toBe('system');
    const habits = await request(app).get('/api/habits').set(auth(token));
    expect(habits.body.data).toHaveLength(10);
  });
});

describe('habits', () => {
  it('CRUD + toggle + archive + delete', async () => {
    const { token } = await registerUser();
    const c = await request(app).post('/api/habits').set(auth(token)).send({ name: 'Read 10 pages', category: 'mind' });
    expect(c.status).toBe(201);
    const id = c.body.data._id;

    const t = await request(app).post(`/api/habits/${id}/log`).set(auth(token)).send({ completed: true });
    expect(t.status).toBe(200);
    let list = await request(app).get('/api/habits').set(auth(token));
    let h = list.body.data.find((x: { _id: string }) => x._id === id);
    expect(h.completedToday).toBe(true);
    expect(h.streak.current).toBe(1);

    // idempotent
    await request(app).post(`/api/habits/${id}/log`).set(auth(token)).send({ completed: true });
    await request(app).post(`/api/habits/${id}/log`).set(auth(token)).send({ completed: false });
    list = await request(app).get('/api/habits').set(auth(token));
    h = list.body.data.find((x: { _id: string }) => x._id === id);
    expect(h.completedToday).toBe(false);

    await request(app).patch(`/api/habits/${id}`).set(auth(token)).send({ archived: true });
    list = await request(app).get('/api/habits').set(auth(token));
    expect(list.body.data.find((x: { _id: string }) => x._id === id)).toBeUndefined();
    list = await request(app).get('/api/habits?includeArchived=true').set(auth(token));
    expect(list.body.data.find((x: { _id: string }) => x._id === id)).toBeDefined();

    expect((await request(app).delete(`/api/habits/${id}`).set(auth(token))).status).toBe(200);
    expect((await request(app).patch(`/api/habits/${id}`).set(auth(token)).send({ name: 'x' })).status).toBe(404);
  });

  it('isolates users', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const c = await request(app).post('/api/habits').set(auth(a.token)).send({ name: 'Private' });
    const id = c.body.data._id;
    expect((await request(app).patch(`/api/habits/${id}`).set(auth(b.token)).send({ name: 'hacked' })).status).toBe(404);
    expect((await request(app).post(`/api/habits/${id}/log`).set(auth(b.token)).send({ completed: true })).status).toBe(404);
    expect((await request(app).delete(`/api/habits/${id}`).set(auth(b.token))).status).toBe(404);
  });

  it('rejects invalid ids and dates', async () => {
    const { token } = await registerUser();
    expect((await request(app).patch('/api/habits/not-an-id').set(auth(token)).send({ name: 'x' })).status).toBe(400);
    const c = await request(app).post('/api/habits').set(auth(token)).send({ name: 'X' });
    expect((await request(app).post(`/api/habits/${c.body.data._id}/log`).set(auth(token)).send({ completed: true, date: '2026-13-45' })).status).toBe(400);
  });

  it('reorders', async () => {
    const { token } = await registerUser();
    const list = await request(app).get('/api/habits').set(auth(token));
    const ids = list.body.data.map((h: { _id: string }) => h._id).reverse();
    expect((await request(app).put('/api/habits/reorder').set(auth(token)).send({ ids })).status).toBe(200);
    const after = await request(app).get('/api/habits').set(auth(token));
    expect(after.body.data[0]._id).toBe(ids[0]);
  });

  it('heatmap returns N days', async () => {
    const { token } = await registerUser();
    const r = await request(app).get('/api/habits/heatmap?days=30').set(auth(token));
    expect(r.body.data).toHaveLength(30);
    expect(r.body.data[29].scheduled).toBe(10);
  });
});

describe('streak logic', () => {
  const h = { _id: new Types.ObjectId(), frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  it('does not break today if today not yet done', () => {
    const s = computeStreaks(h, new Set(['2026-11-06', '2026-11-07', '2026-11-08']), '2026-11-09');
    expect(s.current).toBe(3);
  });
  it('breaks on a missed day and tracks best', () => {
    const s = computeStreaks(h, new Set(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-08', '2026-11-09']), '2026-11-09');
    expect(s.current).toBe(2);
    expect(s.best).toBe(4);
  });
  it('weekly habits skip unscheduled days', () => {
    // Mon/Wed/Fri; 2026-11-09 is Monday
    const w = { ...h, frequency: 'weekly', daysOfWeek: [1, 3, 5] };
    const s = computeStreaks(w, new Set(['2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']), '2026-11-09');
    expect(s.current).toBe(4);
  });
});

describe('water + dashboard', () => {
  it('adds, totals, deletes water and reflects in dashboard score', async () => {
    const { token } = await registerUser();
    const a = await request(app).post('/api/water').set(auth(token)).send({ amountMl: 500 });
    await request(app).post('/api/water').set(auth(token)).send({ amountMl: 250 });
    expect(a.status).toBe(201);
    let d = await request(app).get('/api/water').set(auth(token));
    expect(d.body.data.totalMl).toBe(750);
    expect(d.body.data.targetMl).toBe(3000);

    const bad = await request(app).post('/api/water').set(auth(token)).send({ amountMl: -5 });
    expect(bad.status).toBe(400);

    const dash = await request(app).get('/api/dashboard').set(auth(token));
    expect(dash.status).toBe(200);
    expect(dash.body.data.water.totalMl).toBe(750);
    const comps = dash.body.data.scoreComponents as { key: string; ratio: number }[];
    expect(comps.find((c) => c.key === 'habits')!.ratio).toBe(0);
    expect(comps.find((c) => c.key === 'water')!.ratio).toBe(0.25);
    const expected = Math.round((comps.reduce((s, c) => s + c.ratio, 0) / comps.length) * 100);
    expect(dash.body.data.score).toBe(expected);
    expect(dash.body.data.weekly).toHaveLength(7);
    expect(dash.body.data.habits.scheduled).toBe(10);

    await request(app).delete(`/api/water/${a.body.data._id}`).set(auth(token));
    d = await request(app).get('/api/water').set(auth(token));
    expect(d.body.data.totalMl).toBe(250);

    const hist = await request(app).get('/api/water/history?days=7').set(auth(token));
    expect(hist.body.data).toHaveLength(7);
    expect(hist.body.data[6].totalMl).toBe(250);
  });
});

describe('errors', () => {
  it('unknown route → 404 envelope; malformed JSON → 400', async () => {
    const r = await request(app).get('/api/nope');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ success: false });
    const m = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(m.status).toBe(400);
  });
  it('serves health and openapi', async () => {
    expect((await request(app).get('/api/health')).body.data.status).toBe('ok');
    expect((await request(app).get('/api/openapi.json')).body.openapi).toBe('3.0.3');
  });
});
