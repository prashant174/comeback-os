import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDB, resetDB, closeDB, registerUser, auth } from './helpers.js';
import { RoutineModel } from '../src/models/routine.js';
import { ExerciseModel, WorkoutPlanModel } from '../src/models/fitness.js';
import { FoodModel, MealPlanModel } from '../src/models/nutrition.js';
import { LearningPathModel } from '../src/models/learning.js';
import { GroomingTaskModel } from '../src/models/grooming.js';
import { GoalModel } from '../src/models/wellbeing.js';
import { ReminderModel, NotificationModel } from '../src/models/notify.js';
import { UserPreferenceModel } from '../src/models/UserPreference.js';
import { runRemindersTick } from '../src/jobs/reminders.job.js';
import { _resetSeedCache } from '../src/services/seed.service.js';
import { dayKey, shiftDay, weekdayOf } from '../src/utils/date.js';
import { nowIn } from '../src/utils/time.js';

beforeAll(connectTestDB);
beforeEach(async () => { await resetDB(); _resetSeedCache(); });
afterAll(closeDB);

const today = () => dayKey(new Date(), 'Asia/Kolkata');
// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

describe('seeding', () => {
  it('seeds every module once on registration', async () => {
    const { res } = await registerUser();
    const user = res.body.data.user._id;
    expect(await RoutineModel.countDocuments({ user })).toBe(4); // Weekdays, Saturday, Sunday, Leave day
    expect(await ExerciseModel.countDocuments({ user })).toBe(15);
    expect(await WorkoutPlanModel.countDocuments({ user })).toBe(7);
    expect(await FoodModel.countDocuments({ user })).toBe(22);
    expect(await FoodModel.countDocuments({ user, verified: true })).toBe(0); // seed values are estimates
    expect(await MealPlanModel.countDocuments({ user })).toBe(7);
    expect(await LearningPathModel.countDocuments({ user })).toBe(3);
    expect(await GroomingTaskModel.countDocuments({ user })).toBe(10);
    expect(await GoalModel.countDocuments({ user })).toBe(7);
    expect(await ReminderModel.countDocuments({ user })).toBe(10);
  });

  it('lazily seeds an existing user exactly once under parallel requests', async () => {
    const { res, token } = await registerUser();
    const user = res.body.data.user._id;
    await Promise.all([RoutineModel.deleteMany({ user }), ExerciseModel.deleteMany({ user }), WorkoutPlanModel.deleteMany({ user })]);
    await UserPreferenceModel.updateOne({ user }, { $pull: { seededModules: { $in: ['routines', 'fitness', 'leaveRoutine'] } } });
    _resetSeedCache();
    await Promise.all(Array.from({ length: 6 }, () => request(app).get('/api/dashboard').set(auth(token))));
    expect(await RoutineModel.countDocuments({ user })).toBe(4);
    expect(await ExerciseModel.countDocuments({ user })).toBe(15);
  });

  it('does not re-seed after the user deletes starter data', async () => {
    const { res, token } = await registerUser();
    const user = res.body.data.user._id;
    await GoalModel.deleteMany({ user });
    _resetSeedCache();
    await request(app).get('/api/goals').set(auth(token));
    expect(await GoalModel.countDocuments({ user })).toBe(0);
  });
});

describe('routine', () => {
  it('returns the day routine, tracks status and notes, prevents day clashes', async () => {
    const { token } = await registerUser();
    const d = await request(app).get('/api/routines/day').set(auth(token));
    expect(d.status).toBe(200);
    expect(d.body.data.activities.length).toBeGreaterThan(3);
    const act = d.body.data.activities[0];
    await request(app).put(`/api/routines/day/${today()}/status`).set(auth(token)).send({ activityId: act._id, status: 'done' });
    await request(app).put(`/api/routines/day/${today()}/note`).set(auth(token)).send({ note: 'Good day' });
    const d2 = await request(app).get('/api/routines/day').set(auth(token));
    expect(d2.body.data.activities[0].status).toBe('done');
    expect(d2.body.data.note).toBe('Good day');

    const clash = await request(app).post('/api/routines').set(auth(token)).send({ name: 'Extra', days: [1], activities: [] });
    expect(clash.status).toBe(409);
    const bad = await request(app).post('/api/routines').set(auth(token)).send({ name: 'Bad', days: [1], isActive: false, activities: [{ title: 'x', start: '10:00', end: '09:00' }] });
    expect(bad.status).toBe(400);
    const week = await request(app).get('/api/routines/week').set(auth(token));
    expect(week.body.data).toHaveLength(7);
    expect(week.body.data[6].routine.name).toBe('Saturday');
  });
});

describe('fitness', () => {
  it('plan, logs, records, measurements → profile weight', async () => {
    const { token } = await registerUser();
    const t = await request(app).get('/api/fitness/today').set(auth(token));
    expect(t.body.data.plan.dayOfWeek).toBe(weekdayOf(today()));
    const log = await request(app).post('/api/fitness/logs').set(auth(token)).send({
      date: today(), title: 'Push', durationMin: 30,
      entries: [{ name: 'Incline push-ups', sets: [{ reps: 12 }, { reps: 14 }, { reps: 10 }] }, { name: 'Plank', sets: [{ durationSec: 40 }] }],
    });
    expect(log.status).toBe(201);
    const rec = await request(app).get('/api/fitness/records').set(auth(token));
    expect(rec.body.data.find((r: { name: string }) => r.name === 'Incline push-ups').bestReps).toBe(14);
    const hist = await request(app).get('/api/fitness/history?name=Plank').set(auth(token));
    expect(hist.body.data[0].totalSec).toBe(40);

    await request(app).post('/api/fitness/measurements').set(auth(token)).send({ date: shiftDay(today(), -7), weightKg: 57 });
    await request(app).post('/api/fitness/measurements').set(auth(token)).send({ date: today(), weightKg: 57.8, waistCm: 74 });
    const s = await request(app).get('/api/settings').set(auth(token));
    expect(s.body.data.profile.personal.currentWeightKg).toBe(57.8);

    const plan = await request(app).put('/api/fitness/plans/0').set(auth(token)).send({ title: 'Active rest', focus: 'recovery', items: [{ name: 'Walking', sets: 1, durationSec: 900 }] });
    expect(plan.body.data.title).toBe('Active rest');
  });

  it('uploads progress photos privately and rejects non-images', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const up = await request(app).post('/api/fitness/photos').set(auth(a.token)).field('note', 'week 1').attach('photo', PNG, { filename: 'p.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    const id = up.body.data._id;
    expect((await request(app).get(`/api/fitness/photos/${id}/file`).set(auth(a.token))).status).toBe(200);
    expect((await request(app).get(`/api/fitness/photos/${id}/file`).set(auth(b.token))).status).toBe(404);
    const bad = await request(app).post('/api/fitness/photos').set(auth(a.token)).attach('photo', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' });
    expect(bad.status).toBe(400);
    expect((await request(app).delete(`/api/fitness/photos/${id}`).set(auth(a.token))).status).toBe(200);
  });
});

describe('nutrition', () => {
  it('computes macros, day totals, plan apply, grocery list; blocks other users foods', async () => {
    const a = await registerUser();
    const foods = await request(app).get('/api/nutrition/foods?q=egg').set(auth(a.token));
    const egg = foods.body.data[0];
    expect(egg.verified).toBe(false);
    const e = await request(app).post('/api/nutrition/entries').set(auth(a.token)).send({ date: today(), mealType: 'breakfast', food: egg._id, quantityG: 100 });
    expect(e.status).toBe(201);
    expect(e.body.data.macros.protein).toBe(12.6);
    expect(e.body.data.estimated).toBe(true);

    const upd = await request(app).patch(`/api/nutrition/entries/${e.body.data._id}`).set(auth(a.token)).send({ quantityG: 150 });
    expect(upd.body.data.macros.protein).toBe(18.9);

    const applied = await request(app).post(`/api/nutrition/plan/${weekdayOf(today())}/apply`).set(auth(a.token)).send({ date: today(), mealType: 'lunch' });
    expect(applied.status).toBe(201);
    expect(applied.body.data.length).toBeGreaterThan(1);
    const day = await request(app).get('/api/nutrition/day').set(auth(a.token));
    expect(day.body.data.totals.protein).toBeGreaterThan(18.9);
    expect(day.body.data.hasEstimates).toBe(true);
    expect(day.body.data.meals.lunch.entries.length).toBe(applied.body.data.length);

    const g = await request(app).get('/api/nutrition/grocery').set(auth(a.token));
    expect(g.body.data.find((x: { name: string }) => x.name === 'Egg (whole)').units).toBeGreaterThan(5);

    const b = await registerUser();
    const steal = await request(app).post('/api/nutrition/entries').set(auth(b.token)).send({ date: today(), mealType: 'breakfast', food: egg._id, quantityG: 100 });
    expect(steal.status).toBe(400);

    const custom = await request(app).post('/api/nutrition/foods').set(auth(a.token)).send({ name: 'Whey', per100g: { kcal: 400, protein: 80, carbs: 8, fat: 6, fiber: 0 }, verified: true, source: 'Pack label' });
    expect(custom.status).toBe(201);
    const badFood = await request(app).post('/api/nutrition/foods').set(auth(a.token)).send({ name: 'X', per100g: { kcal: 10, protein: 150, carbs: 0, fat: 0, fiber: 0 } });
    expect(badFood.status).toBe(400);
  });
});

describe('learning, finance, grooming', () => {
  it('learning summary and topic completion', async () => {
    const { token } = await registerUser();
    const paths = await request(app).get('/api/learning/paths').set(auth(token));
    const p = paths.body.data[0];
    const topics = p.topics.map((t: { done: boolean }, i: number) => ({ ...t, done: i < 2 }));
    const u = await request(app).patch(`/api/learning/paths/${p._id}`).set(auth(token)).send({ topics });
    expect(u.body.data.topics[0].doneAt).toBeTruthy();
    expect(u.body.data.topics[5].doneAt).toBeNull();
    await request(app).post('/api/learning/sessions').set(auth(token)).send({ date: today(), minutes: 25, mode: 'pomodoro', path: p._id, topic: 'Loops' });
    const s = await request(app).get('/api/learning/summary').set(auth(token));
    expect(s.body.data.todayMinutes).toBe(25);
    expect(s.body.data.roadmap.doneTopics).toBe(2);
    expect(s.body.data.roadmap.day).toBe(1);
  });

  it('finance summary, budget alerts and recurring copy', async () => {
    const { token } = await registerUser();
    const month = today().slice(0, 7);
    const e = await request(app).post('/api/finance/expenses').set(auth(token)).send({ date: today(), amount: 850.456, category: 'Clothing', note: 'Shirt', recurring: true });
    expect(e.body.data.amount).toBe(850.46);
    await new Promise((r) => setTimeout(r, 300)); // alert check runs async
    const n = await request(app).get('/api/notifications').set(auth(token));
    expect(n.body.data.some((x: { title: string }) => x.title.includes('Clothing budget exceeded'))).toBe(true);
    const s = await request(app).get(`/api/finance/summary?month=${month}`).set(auth(token));
    expect(s.body.data.totalLimit).toBe(2500);
    expect(s.body.data.spent).toBe(850.46);
    expect(s.body.data.categories.find((c: { name: string }) => c.name === 'Clothing').pct).toBe(106);

    const [y, m] = month.split('-').map(Number);
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`;
    const r1 = await request(app).post('/api/finance/recurring/apply').set(auth(token)).send({ month: next });
    expect(r1.body.data).toHaveLength(1);
    const r2 = await request(app).post('/api/finance/recurring/apply').set(auth(token)).send({ month: next });
    expect(r2.body.data).toHaveLength(0);

    const dup = await request(app).put('/api/finance/budget').set(auth(token)).send({ categories: [{ name: 'Food', limit: 1 }, { name: 'food', limit: 2 }] });
    expect(dup.status).toBe(400);
  });

  it('grooming due logic for daily, weekly and interval tasks', async () => {
    const { token } = await registerUser();
    const t = await request(app).get('/api/grooming/today').set(auth(token));
    const items = t.body.data.items;
    const haircut = items.find((i: { title: string }) => i.title === 'Haircut');
    expect(haircut.due).toBe(true); // never done → due
    await request(app).post(`/api/grooming/tasks/${haircut._id}/log`).set(auth(token)).send({ date: shiftDay(today(), -3), done: true });
    const t2 = await request(app).get('/api/grooming/today').set(auth(token));
    const h2 = t2.body.data.items.find((i: { title: string }) => i.title === 'Haircut');
    expect(h2.due).toBe(false);
    expect(h2.nextDue).toBe(shiftDay(today(), 27));
    const daily = items.find((i: { frequency: string }) => i.frequency === 'daily');
    await request(app).post(`/api/grooming/tasks/${daily._id}/log`).set(auth(token)).send({ done: true });
    const t3 = await request(app).get('/api/grooming/today').set(auth(token));
    expect(t3.body.data.items.find((i: { _id: string }) => i._id === daily._id).doneToday).toBe(true);
  });
});

describe('sleep, goals, journal', () => {
  it('sleep duration across midnight and summary', async () => {
    const { token } = await registerUser();
    const r = await request(app).post('/api/sleep').set(auth(token)).send({ date: today(), bedtime: '23:30', wakeTime: '06:15', quality: 4 });
    expect(r.body.data.durationMin).toBe(405);
    await request(app).post('/api/sleep').set(auth(token)).send({ date: shiftDay(today(), -1), bedtime: '00:30', wakeTime: '06:30', quality: 2 });
    const dup = await request(app).post('/api/sleep').set(auth(token)).send({ date: today(), bedtime: '23:00', wakeTime: '06:00' });
    expect(dup.status).toBe(409);
    const s = await request(app).get('/api/sleep/summary?days=7').set(auth(token));
    expect(s.body.data.stats.logged).toBe(2);
    expect(s.body.data.stats.avgHours).toBe(6.4);
    expect(s.body.data.stats.bedtimeSdMin).toBe(30);
  });

  it('goal progress follows milestones', async () => {
    const { token } = await registerUser();
    const goals = await request(app).get('/api/goals').set(auth(token));
    const g = goals.body.data[0];
    const ms = g.milestones.map((m: object, i: number) => ({ ...m, done: i === 0 }));
    const u = await request(app).patch(`/api/goals/${g._id}`).set(auth(token)).send({ milestones: ms });
    expect(u.body.data.progress).toBe(Math.round(100 / ms.length));
  });

  it('journal search and tags', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/journal').set(auth(token)).send({ date: today(), mood: 4, reflection: 'Finished the pandas chapter', tags: ['Learning'] });
    await request(app).post('/api/journal').set(auth(token)).send({ date: today(), mood: 2, reflection: 'Skipped workout', tags: ['fitness'] });
    const s = await request(app).get('/api/journal?q=pandas').set(auth(token));
    expect(s.body.data).toHaveLength(1);
    const tags = await request(app).get('/api/journal/tags').set(auth(token));
    expect(tags.body.data.sort()).toEqual(['fitness', 'learning']);
    const byTag = await request(app).get('/api/journal?tags=fitness').set(auth(token));
    expect(byTag.body.data).toHaveLength(1);
  });
});

describe('reminders, analytics, dashboard', () => {
  it('fires a due reminder once per day', async () => {
    const { res, token } = await registerUser();
    const { hhmm, weekday } = nowIn('Asia/Kolkata');
    await ReminderModel.deleteMany({});
    await request(app).post('/api/reminders').set(auth(token)).send({ title: 'Test ping', time: hhmm, days: [weekday] });
    expect(await runRemindersTick()).toBe(1);
    expect(await runRemindersTick()).toBe(0);
    expect(await NotificationModel.countDocuments({ user: res.body.data.user._id, title: 'Test ping' })).toBe(1);
    const n = await request(app).get('/api/notifications').set(auth(token));
    expect(n.body.meta.unread).toBeGreaterThan(0);
    await request(app).post('/api/notifications/read-all').set(auth(token));
    expect((await request(app).get('/api/notifications').set(auth(token))).body.meta.unread).toBe(0);
  });

  it('analytics + CSV export (with formula escaping)', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/finance/expenses').set(auth(token)).send({ date: today(), amount: 120, category: 'Miscellaneous', note: '=HYPERLINK("x")' });
    await request(app).post('/api/learning/sessions').set(auth(token)).send({ date: today(), minutes: 40 });
    const a = await request(app).get('/api/analytics?days=30').set(auth(token));
    expect(a.body.data.series).toHaveLength(30);
    expect(a.body.data.kpis.studyHours).toBe(0.7);
    expect(a.body.data.expensesByCategory[0].category).toBe('Miscellaneous');
    const csv = await request(app).get('/api/analytics/export?module=expenses').set(auth(token));
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain(`"'=HYPERLINK(""x"")"`);
    expect((await request(app).get('/api/analytics/export?module=passwords').set(auth(token))).status).toBe(400);
  });

  it('dashboard includes new modules and score components', async () => {
    const { token } = await registerUser();
    await request(app).post('/api/learning/sessions').set(auth(token)).send({ date: today(), minutes: 40 });
    const d = await request(app).get('/api/dashboard').set(auth(token));
    expect(d.status).toBe(200);
    const keys = d.body.data.scoreComponents.map((c: { key: string }) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['habits', 'water', 'protein', 'study']));
    expect(keys).not.toContain('sleep'); // not logged yet
    expect(d.body.data.study.minutes).toBe(40);
    expect(d.body.data.routine.activities.length).toBeGreaterThan(0);
    expect(d.body.data.widgets.map((w: { key: string }) => w.key)).toContain('nutrition');
    expect(d.body.data.finance.monthLimit).toBe(2500);
  });

  it('migrates an old widget layout and keeps hidden choices', async () => {
    const { res, token } = await registerUser();
    await UserPreferenceModel.updateOne({ user: res.body.data.user._id }, { dashboardWidgets: [{ key: 'score', visible: true, size: 'md' }, { key: 'water', visible: false, size: 'sm' }] });
    const d = await request(app).get('/api/dashboard').set(auth(token));
    expect(d.body.data.widgets.length).toBe(12);
    expect(d.body.data.widgets.find((w: { key: string }) => w.key === 'water').visible).toBe(false);
  });

  it('avatar upload and fetch', async () => {
    const { token } = await registerUser();
    const up = await request(app).post('/api/settings/avatar').set(auth(token)).attach('avatar', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect(up.body.data.avatarUrl).toMatch(/^\/api\/settings\/avatar/);
    expect((await request(app).get('/api/settings/avatar').set(auth(token))).status).toBe(200);
    expect((await request(app).delete('/api/settings/avatar').set(auth(token))).body.data.avatarUrl).toBeNull();
  });

  it('generic crud isolates users and validates', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const j = await request(app).post('/api/journal').set(auth(a.token)).send({ date: today(), reflection: 'private' });
    expect((await request(app).get(`/api/journal/${j.body.data._id}`).set(auth(b.token))).status).toBe(404);
    expect((await request(app).patch(`/api/journal/${j.body.data._id}`).set(auth(b.token)).send({ mood: 1 })).status).toBe(404);
    expect((await request(app).get('/api/journal').set(auth(b.token))).body.data).toHaveLength(0);
    expect((await request(app).get('/api/journal?limit=9999').set(auth(a.token))).status).toBe(400);
  });
});

describe('date validation', () => {
  it('rejects impossible calendar dates', async () => {
    const { token } = await registerUser();
    expect((await request(app).post('/api/sleep').set(auth(token)).send({ date: '2026-02-31', bedtime: '23:00', wakeTime: '06:00' })).status).toBe(400);
    expect((await request(app).post('/api/sleep').set(auth(token)).send({ date: '2028-02-29', bedtime: '23:00', wakeTime: '06:00' })).status).toBe(201);
  });
});
