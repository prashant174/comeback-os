import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, connectTestDB, resetDB, closeDB, registerUser, auth } from './helpers.js';
import { env } from '../src/config/env.js';
import { ensureAdminAccount } from '../src/services/auth.service.js';
import { _resetSeedCache } from '../src/services/seed.service.js';
import { runWorkDueTick } from '../src/jobs/work.job.js';
import { NotificationModel } from '../src/models/notify.js';
import { WorkTaskModel, WorkLogModel } from '../src/models/work.js';
import { dayKey, shiftDay } from '../src/utils/date.js';

beforeAll(connectTestDB);
beforeEach(async () => { await resetDB(); _resetSeedCache(); });
afterAll(closeDB);

const today = () => dayKey(new Date(), 'Asia/Kolkata');
type T = string;
const post = (tok: T, path: string, body: object) => request(app).post(`/api/work${path}`).set(auth(tok)).send(body);
const patch = (tok: T, path: string, body: object) => request(app).patch(`/api/work${path}`).set(auth(tok)).send(body);
const get = (tok: T, path: string) => request(app).get(`/api/work${path}`).set(auth(tok));

async function setup() {
  const u = await registerUser();
  const sh = await post(u.token, '/stakeholders', { name: 'Mehta', department: 'Design', role: 'HOD' });
  const pr = await post(u.token, '/projects', { name: 'Design MIS', department: 'Design', stakeholders: [sh.body.data._id], status: 'in_progress', progress: 30, links: [{ label: 'Repo', url: 'https://github.com/x/y' }] });
  return { u, tok: u.token, sh: sh.body.data, pr: pr.body.data };
}

describe('work: projects, stakeholders, isolation', () => {
  it('creates linked records and rejects links to another user’s data', async () => {
    const { tok, sh, pr } = await setup();
    expect(pr.stakeholders).toEqual([sh._id]);
    const other = await registerUser();
    const steal = await post(other.token, '/tasks', { title: 'x', project: pr._id });
    expect(steal.status).toBe(400);
    expect((await post(other.token, '/projects', { name: 'y', stakeholders: [sh._id] })).status).toBe(400);
    expect((await get(other.token, `/projects/${pr._id}`)).status).toBe(404);
    expect((await get(other.token, '/projects')).body.data).toHaveLength(0);
    expect((await post(tok, '/projects', { name: 'Bad link', links: [{ label: 'x', url: 'not a url' }] })).status).toBe(400);
    expect((await post(tok, '/projects', { name: 'Bad dates', startDate: '2026-12-10', targetDate: '2026-12-01' })).status).toBe(400);
  });

  it('deleting a stakeholder unlinks it; deleting a project keeps tasks/logs', async () => {
    const { tok, sh, pr } = await setup();
    const t = await post(tok, '/tasks', { title: 'Build filters', project: pr._id });
    await post(tok, '/logs', { date: today(), project: pr._id, description: 'Filters', minutes: 60 });
    await request(app).delete(`/api/work/stakeholders/${sh._id}`).set(auth(tok));
    expect((await get(tok, `/projects/${pr._id}`)).body.data.stakeholders).toEqual([]);
    await request(app).delete(`/api/work/projects/${pr._id}`).set(auth(tok));
    const task = await get(tok, `/tasks/${t.body.data._id}`);
    expect(task.status).toBe(200);
    expect(task.body.data.project).toBeNull();
    expect(await WorkLogModel.countDocuments({ project: null })).toBe(1);
  });
});

describe('work: tasks & board', () => {
  it('blocked needs a reason, done stamps completion, board views filter', async () => {
    const { tok, pr } = await setup();
    const a = await post(tok, '/tasks', { title: 'Due today', project: pr._id, dueDate: today(), priority: 'high' });
    const b = await post(tok, '/tasks', { title: 'Overdue', dueDate: shiftDay(today(), -2) });
    await post(tok, '/tasks', { title: 'Later this week', dueDate: shiftDay(today(), 3) });
    expect((await patch(tok, `/tasks/${a.body.data._id}`, { status: 'blocked' })).status).toBe(400);
    const blocked = await patch(tok, `/tasks/${a.body.data._id}`, { status: 'blocked', blockedReason: 'Waiting for data from accounts' });
    expect(blocked.body.data.blockedReason).toMatch(/accounts/);
    const done = await patch(tok, `/tasks/${b.body.data._id}`, { status: 'done' });
    expect(done.body.data.completedDate).toBe(today());
    const reopened = await patch(tok, `/tasks/${b.body.data._id}`, { status: 'todo' });
    expect(reopened.body.data.completedDate).toBeNull();
    const unblock = await patch(tok, `/tasks/${a.body.data._id}`, { status: 'in_progress' });
    expect(unblock.body.data.blockedReason).toBe('');

    expect((await get(tok, '/tasks/board?view=today')).body.data.tasks.map((t: { title: string }) => t.title)).toEqual(['Due today']);
    expect((await get(tok, '/tasks/board?view=overdue')).body.data.tasks.map((t: { title: string }) => t.title)).toEqual(['Overdue']);
    expect((await get(tok, '/tasks/board?view=week')).body.data.tasks).toHaveLength(2);
    const all = await get(tok, '/tasks/board');
    expect(all.body.data.tasks).toHaveLength(3);
    expect(all.body.data.tasks.find((t: { title: string }) => t.title === 'Due today').project.name).toBe('Design MIS');
  });
});

describe('work: requirements & meetings create tasks', () => {
  it('requirement → task (once); finishing the task delivers the requirement', async () => {
    const { tok, sh, pr } = await setup();
    const rq = await post(tok, '/requirements', { title: 'Monthly drawing status report', stakeholder: sh._id, project: pr._id, date: today(), priority: 'high' });
    const made = await post(tok, `/requirements/${rq.body.data._id}/task`, { dueDate: shiftDay(today(), 5) });
    expect(made.status).toBe(201);
    expect(made.body.data.requirement.status).toBe('accepted');
    expect(made.body.data.task).toMatchObject({ title: 'Monthly drawing status report', priority: 'high', source: { kind: 'requirement' } });
    expect((await post(tok, `/requirements/${rq.body.data._id}/task`, {})).status).toBe(409);
    await patch(tok, `/tasks/${made.body.data.task._id}`, { status: 'done' });
    expect((await get(tok, `/requirements/${rq.body.data._id}`)).body.data.status).toBe('delivered');
    // deleting the task frees the requirement to get a new one
    await request(app).delete(`/api/work/tasks/${made.body.data.task._id}`).set(auth(tok));
    expect((await get(tok, `/requirements/${rq.body.data._id}`)).body.data.task).toBeNull();
  });

  it('meeting action item → task (once)', async () => {
    const { tok, sh, pr } = await setup();
    const m = await post(tok, '/meetings', { title: 'Kickoff', date: today(), project: pr._id, attendees: [sh._id], decisions: 'Weekly review on Fridays',
      actionItems: [{ text: 'Share Excel templates', assignee: 'Mehta', dueDate: shiftDay(today(), 2) }, { text: 'Draft data model' }] });
    expect(m.status).toBe(201);
    const ai = m.body.data.actionItems[0];
    const made = await post(tok, `/meetings/${m.body.data._id}/actions/${ai._id}/task`, {});
    expect(made.status).toBe(201);
    expect(made.body.data.task).toMatchObject({ title: 'Share Excel templates', assignee: 'Mehta', source: { kind: 'meeting' } });
    expect(made.body.data.meeting.actionItems[0].task).toBe(made.body.data.task._id);
    expect((await post(tok, `/meetings/${m.body.data._id}/actions/${ai._id}/task`, {})).status).toBe(409);
    const other = await registerUser();
    expect((await post(other.token, `/meetings/${m.body.data._id}/actions/${ai._id}/task`, {})).status).toBe(404);
  });
});

describe('work: log, report, summary, analytics, export', () => {
  it('daily log, weekly report text, dashboard + analytics + CSV', async () => {
    const { tok, sh, pr } = await setup();
    const t = await post(tok, '/tasks', { title: 'Connect Excel sheets', project: pr._id });
    await patch(tok, `/tasks/${t.body.data._id}`, { status: 'done' });
    await post(tok, '/tasks', { title: 'Waiting', project: pr._id, status: 'blocked', blockedReason: 'Need DB access' });
    await post(tok, '/tasks', { title: 'Due today', dueDate: today() });
    await post(tok, '/logs', { date: today(), project: pr._id, description: 'Excel import', minutes: 90 });
    await post(tok, '/logs', { date: today(), description: 'Admin', minutes: 30 });
    expect((await post(tok, '/logs', { date: today(), description: 'x', minutes: 0 })).status).toBe(400);
    await post(tok, '/changes', { project: pr._id, date: today(), version: 'v0.1', type: 'feature', environment: 'uat', summary: 'First dashboard' });
    const rq = await post(tok, '/requirements', { title: 'Status by architect', stakeholder: sh._id, date: today() });
    await patch(tok, `/requirements/${rq.body.data._id}`, { status: 'delivered' });

    const day = await get(tok, '/logs/day');
    expect(day.body.data.totalMinutes).toBe(120);
    expect(day.body.data.doneTasks.map((x: { title: string }) => x.title)).toEqual(['Connect Excel sheets']);

    const rep = await get(tok, '/report/weekly');
    expect(rep.status).toBe(200);
    const text: string = rep.body.data.text;
    expect(text).toContain('Connect Excel sheets [Design MIS]');
    expect(text).toContain('Need DB access');
    expect(text).toContain('v0.1 (UAT): First dashboard');
    expect(text).toContain('Status by architect — for Mehta');
    expect(text).toContain('Time logged: 2h');
    expect(text).toContain(`Due today (due ${today()})`); // open task due this week is listed
    expect(text).not.toContain('Connect Excel sheets (due'); // done tasks aren't
    expect(rep.body.data.hours[0]).toMatchObject({ name: 'Design MIS', minutes: 90 });

    const sum = await get(tok, '/summary');
    expect(sum.body.data).toMatchObject({ dueTodayCount: 1, blocked: 1, minutesToday: 120 });
    const dash = await request(app).get('/api/dashboard').set(auth(tok));
    expect(dash.body.data.work.minutesToday).toBe(120);
    expect(dash.body.data.scoreComponents.map((c: { key: string }) => c.key)).not.toContain('work');
    expect(dash.body.data.widgets.map((w: { key: string }) => w.key)).toContain('work');

    const an = await request(app).get('/api/analytics?days=7').set(auth(tok));
    expect(an.body.data.kpis.workHours).toBe(2);
    expect(an.body.data.workByProject[0].name).toBe('Design MIS');
    const csv = await request(app).get('/api/analytics/export?module=worklog').set(auth(tok));
    expect(csv.text).toContain('Design MIS,Excel import,90');
    const sp = await get(tok, `/projects/${pr._id}/summary`);
    expect(sp.body.data).toMatchObject({ totalMinutes: 90, tasks: { done: 1, blocked: 1 } });
  });
});

describe('work: reminders, admin, deletion', () => {
  it('sends one due-tasks notification at 9:30 and stays quiet on leave', async () => {
    const { u, tok } = await setup();
    await post(tok, '/tasks', { title: 'Due', dueDate: today() });
    await post(tok, '/tasks', { title: 'Late', dueDate: shiftDay(today(), -1) });
    const at = (hh: number, mm: number) => new Date(`${today()}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+05:30`);
    expect(await runWorkDueTick(at(8, 0))).toBe(0);
    expect(await runWorkDueTick(at(9, 35))).toBe(1);
    expect(await runWorkDueTick(at(9, 40))).toBe(0);
    const n = await NotificationModel.findOne({ user: u.res.body.data.user._id, kind: 'work' }).lean();
    expect(n).toMatchObject({ title: '1 work task due today', body: 'Plus 1 overdue.', link: '/work' });

    const v = await registerUser();
    await post(v.token, '/tasks', { title: 'Due', dueDate: today() });
    await request(app).post('/api/routines/overrides').set(auth(v.token)).send({ from: today(), to: today(), type: 'leave' });
    expect(await runWorkDueTick(at(9, 35))).toBe(0);
  });

  it('admin cannot read work data; deleting a user removes it', async () => {
    const { u, tok } = await setup();
    env.ADMIN_EMAIL = 'admin@cbos.dev'; env.ADMIN_PASSWORD = 'AdminPassw0rd2026';
    try {
      await ensureAdminAccount();
      const adm = (await request(app).post('/api/auth/login').send({ email: 'admin@cbos.dev', password: 'AdminPassw0rd2026' })).body.data.accessToken;
      expect((await get(adm, '/projects')).status).toBe(403);
      expect(await WorkTaskModel.countDocuments({ user: u.res.body.data.user._id })).toBe(0);
      await post(tok, '/tasks', { title: 'x' });
      const del = await request(app).delete(`/api/admin/users/${u.res.body.data.user._id}`).set(auth(adm)).send({ confirmEmail: u.body.email.toLowerCase() });
      expect(del.status).toBe(200);
      expect(await WorkTaskModel.countDocuments({ user: u.res.body.data.user._id })).toBe(0);
    } finally { env.ADMIN_EMAIL = undefined; env.ADMIN_PASSWORD = undefined; }
  });
});
