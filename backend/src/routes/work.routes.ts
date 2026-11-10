import { Router } from 'express';
import { z } from 'zod';
import {
  CHANGE_TYPES, ENVIRONMENTS, PROJECT_STATUS, REQ_STATUS, TASK_STATUS,
  ChangeLogModel, MeetingModel, RequirementModel, StakeholderModel, WorkLogModel, WorkProjectModel, WorkTaskModel,
} from '../models/work.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, idParam, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { applyTaskRules, assertOwned, boardTasks, createLinkedTask, hoursByProject, projectSummary, weeklyReport, workDay, workSummary } from '../services/work.service.js';
import { shiftDay } from '../utils/date.js';

const r = Router();
const PRIORITY = z.enum(['low', 'medium', 'high', 'urgent']);
const optRef = objectId.nullable().optional();
const optDay = dayKeySchema.nullable().optional();

/* ---------------- Stakeholders ---------------- */
r.use('/stakeholders', crudRouter({
  model: StakeholderModel,
  create: z.object({
    name: z.string().trim().min(1).max(80),
    department: z.string().trim().max(60).default(''),
    role: z.string().trim().max(60).default(''),
    note: z.string().max(300).default(''),
  }),
  searchFields: ['name', 'department', 'role'], filters: ['department'], sort: { name: 1 }, maxLimit: 500,
  afterWrite: async (doc, req, op) => {
    if (op !== 'delete') return;
    // unlink everywhere so nothing points at a deleted person
    await Promise.all([
      WorkProjectModel.updateMany({ user: req.user!.id }, { $pull: { stakeholders: doc._id } }),
      MeetingModel.updateMany({ user: req.user!.id }, { $pull: { attendees: doc._id } }),
      RequirementModel.updateMany({ user: req.user!.id, stakeholder: doc._id }, { $set: { stakeholder: null, requestedBy: doc.name } }),
    ]);
  },
}));

/* ---------------- Projects ---------------- */
const link = z.object({ label: z.string().trim().min(1).max(60), url: z.string().url('Links must be full URLs (https://…)').max(500) });
r.get('/projects/:id/summary', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await projectSummary(req.user!.id, req.params.id))));
r.use('/projects', crudRouter({
  model: WorkProjectModel,
  create: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000).default(''),
    department: z.string().trim().max(60).default(''),
    stakeholders: z.array(objectId).max(50).default([]),
    status: z.enum(PROJECT_STATUS).default('planning'),
    priority: PRIORITY.default('medium'),
    startDate: optDay, targetDate: optDay,
    progress: z.number().int().min(0).max(100).default(0),
    links: z.array(link).max(20).default([]),
    techStack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    archived: z.boolean().default(false),
  }),
  searchFields: ['name', 'department', 'description'], filters: ['status', 'archived', 'priority'], sort: { archived: 1, updatedAt: -1 },
  transform: async (body, req) => {
    await assertOwned(req.user!.id, { stakeholders: body.stakeholders });
    if (body.startDate && body.targetDate && body.targetDate < body.startDate) throw ApiError.badRequest('Target date must be after the start date');
    return body;
  },
  afterWrite: async (doc, req, op) => {
    if (op !== 'delete') return;
    // keep history readable: detach instead of deleting tasks/logs/requirements
    const q = { user: req.user!.id, project: doc._id };
    await Promise.all([
      WorkTaskModel.updateMany(q, { project: null }), WorkLogModel.updateMany(q, { project: null }),
      RequirementModel.updateMany(q, { project: null }), MeetingModel.updateMany(q, { project: null }),
      ChangeLogModel.deleteMany(q),
    ]);
  },
}));

/* ---------------- Tasks ---------------- */
const taskBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(3000).default(''),
  project: optRef,
  status: z.enum(TASK_STATUS).default('todo'),
  blockedReason: z.string().trim().max(300).optional(),
  priority: PRIORITY.default('medium'),
  dueDate: optDay,
  checklist: z.array(z.object({ _id: objectId.optional(), title: z.string().trim().min(1).max(200), done: z.boolean().default(false) })).max(50).default([]),
  estimateHours: z.number().min(0).max(1000).nullable().optional(),
  assignee: z.string().trim().max(60).default('me'),
  order: z.number().optional(),
});
r.get('/tasks/board', validate({ query: z.object({ view: z.enum(['all', 'today', 'overdue', 'week']).default('all'), project: objectId.optional() }) }), asyncHandler(async (req, res) => {
  const q = req.query as { view: 'all' | 'today' | 'overdue' | 'week'; project?: string };
  ok(res, await boardTasks(req.user!.id, q.view, q.project));
}));
r.use('/tasks', crudRouter({
  model: WorkTaskModel, create: taskBody, update: taskBody.partial(),
  searchFields: ['title', 'description'], filters: ['status', 'project', 'priority'], dateField: 'dueDate', sort: { order: 1, dueDate: 1 }, maxLimit: 500,
  transform: async (body, req, existing) => {
    await assertOwned(req.user!.id, { project: body.project });
    return applyTaskRules(req.user!.id, body, existing);
  },
  afterWrite: async (doc, req, op) => {
    // a requirement whose linked task is finished becomes "delivered"
    if (op !== 'delete' && doc.status === 'done' && doc.source?.kind === 'requirement' && doc.source.id) {
      await RequirementModel.updateOne({ _id: doc.source.id, user: req.user!.id, status: { $in: ['new', 'accepted', 'in_progress'] } }, { status: 'delivered' });
    }
    if (op === 'delete') {
      await Promise.all([
        RequirementModel.updateMany({ user: req.user!.id, task: doc._id }, { task: null }),
        MeetingModel.updateMany({ user: req.user!.id, 'actionItems.task': doc._id }, { $set: { 'actionItems.$[a].task': null } }, { arrayFilters: [{ 'a.task': doc._id }] }),
        WorkLogModel.updateMany({ user: req.user!.id, task: doc._id }, { task: null }),
      ]);
    }
  },
}));

/* ---------------- Requirements ---------------- */
const reqBody = z.object({
  title: z.string().trim().min(1).max(200),
  details: z.string().max(3000).default(''),
  project: optRef,
  stakeholder: optRef,
  requestedBy: z.string().trim().max(80).default(''),
  department: z.string().trim().max(60).default(''),
  date: dayKeySchema,
  priority: PRIORITY.default('medium'),
  status: z.enum(REQ_STATUS).default('new'),
});
r.post('/requirements/:id/task', validate({ params: idParam, body: z.object({ dueDate: optDay }).default({}) }), asyncHandler(async (req, res) => {
  const rq = await RequirementModel.findOne({ _id: req.params.id, user: req.user!.id });
  if (!rq) throw ApiError.notFound('Requirement not found');
  if (rq.task && (await WorkTaskModel.exists({ _id: rq.task, user: req.user!.id }))) throw ApiError.conflict('This requirement already has a task');
  const task = await createLinkedTask(req.user!.id, { title: rq.title, description: rq.details, project: rq.project, priority: rq.priority, dueDate: req.body?.dueDate ?? null, source: { kind: 'requirement', id: rq._id } });
  rq.task = task._id;
  if (rq.status === 'new') rq.status = 'accepted';
  await rq.save();
  created(res, { requirement: rq, task });
}));
r.use('/requirements', crudRouter({
  model: RequirementModel, create: reqBody, dateField: 'date', filters: ['status', 'project', 'priority', 'stakeholder'],
  searchFields: ['title', 'details', 'requestedBy', 'department'], sort: { date: -1, createdAt: -1 },
  transform: async (body, req) => {
    await assertOwned(req.user!.id, { project: body.project, stakeholder: body.stakeholder });
    return body;
  },
}));

/* ---------------- Meetings ---------------- */
const meetingBody = z.object({
  title: z.string().trim().min(1).max(150),
  date: dayKeySchema,
  project: optRef,
  attendees: z.array(objectId).max(50).default([]),
  notes: z.string().max(10000).default(''),
  decisions: z.string().max(3000).default(''),
  actionItems: z.array(z.object({
    _id: objectId.optional(), text: z.string().trim().min(1).max(300), assignee: z.string().trim().max(60).default('me'),
    dueDate: optDay, task: objectId.nullable().optional(),
  })).max(50).default([]),
});
r.post('/meetings/:id/actions/:actionId/task', validate({ params: z.object({ id: objectId, actionId: objectId }) }), asyncHandler(async (req, res) => {
  const m = await MeetingModel.findOne({ _id: req.params.id, user: req.user!.id });
  if (!m) throw ApiError.notFound('Meeting not found');
  const item = m.actionItems.id(req.params.actionId);
  if (!item) throw ApiError.notFound('Action item not found');
  if (item.task && (await WorkTaskModel.exists({ _id: item.task, user: req.user!.id }))) throw ApiError.conflict('This action item already has a task');
  const task = await createLinkedTask(req.user!.id, { title: item.text, project: m.project, dueDate: item.dueDate ?? null, assignee: item.assignee || 'me', description: `From meeting “${m.title}” on ${m.date}`, source: { kind: 'meeting', id: m._id } });
  item.task = task._id;
  await m.save();
  created(res, { meeting: m, task });
}));
r.use('/meetings', crudRouter({
  model: MeetingModel, create: meetingBody, dateField: 'date', filters: ['project'], searchFields: ['title', 'notes', 'decisions'], sort: { date: -1, createdAt: -1 },
  transform: async (body, req) => {
    await assertOwned(req.user!.id, { project: body.project, stakeholders: body.attendees });
    if (body.actionItems) for (const a of body.actionItems as { task?: string | null }[]) if (a.task) await assertOwned(req.user!.id, { task: a.task });
    return body;
  },
}));

/* ---------------- Work log ---------------- */
r.get('/logs/day', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
  const date = (req.query as { date?: string }).date ?? (await userToday(req.user!.id));
  ok(res, await workDay(req.user!.id, date));
}));
r.use('/logs', crudRouter({
  model: WorkLogModel,
  create: z.object({
    date: dayKeySchema, project: optRef, task: optRef,
    description: z.string().trim().min(1).max(500),
    minutes: z.number().int().min(1).max(1440),
  }),
  dateField: 'date', filters: ['project'], searchFields: ['description'], sort: { date: -1, createdAt: -1 }, maxLimit: 500,
  transform: async (body, req) => {
    await assertOwned(req.user!.id, { project: body.project, task: body.task });
    return body;
  },
}));

/* ---------------- Change log ---------------- */
r.use('/changes', crudRouter({
  model: ChangeLogModel,
  create: z.object({
    project: objectId, date: dayKeySchema,
    version: z.string().trim().max(30).default(''),
    type: z.enum(CHANGE_TYPES).default('feature'),
    environment: z.enum(ENVIRONMENTS).default('live'),
    summary: z.string().trim().min(1).max(1000),
  }),
  dateField: 'date', filters: ['project', 'type', 'environment'], searchFields: ['summary', 'version'], sort: { date: -1, createdAt: -1 },
  transform: async (body, req) => {
    await assertOwned(req.user!.id, { project: body.project });
    return body;
  },
}));

/* ---------------- Reports & summaries ---------------- */
r.get('/report/weekly', validate({ query: z.object({ date: dayKeySchema.optional() }) }), asyncHandler(async (req, res) => {
  ok(res, await weeklyReport(req.user!.id, (req.query as { date?: string }).date));
}));
r.get('/summary', asyncHandler(async (req, res) => ok(res, await workSummary(req.user!.id, await userToday(req.user!.id)))));
r.get('/hours', validate({ query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }) }), asyncHandler(async (req, res) => {
  const today = await userToday(req.user!.id);
  const days = Number((req.query as { days?: number }).days ?? 30);
  ok(res, await hoursByProject(req.user!.id, shiftDay(today, -(days - 1)), today));
}));

export default r;
