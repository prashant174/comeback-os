import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { LearningPathModel, ProjectModel, StudySessionModel } from '../models/learning.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { dayKeySchema, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { lastNDays } from '../utils/date.js';

const r = Router();

const topic = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(1).max(120),
  done: z.boolean().default(false),
  doneAt: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).default(''),
  subtopics: z.array(z.object({ title: z.string().trim().min(1).max(120), done: z.boolean().default(false) })).max(50).default([]),
});
const pathBody = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().max(500).default(''),
  order: z.number().int().optional(),
  startDate: dayKeySchema.nullable().optional(),
  targetDate: dayKeySchema.nullable().optional(),
  proficiency: z.number().int().min(0).max(5).default(0),
  topics: z.array(topic).max(200).default([]),
  resources: z.array(z.object({ _id: objectId.optional(), title: z.string().trim().min(1).max(120), url: z.string().url().max(500), kind: z.enum(['article', 'video', 'course', 'docs', 'other']).default('other') })).max(100).default([]),
  archived: z.boolean().default(false),
});
r.use('/paths', crudRouter({
  model: LearningPathModel, create: pathBody, sort: { order: 1, createdAt: 1 }, filters: ['archived'],
  transform: (body) => {
    if (body.topics) body.topics = body.topics.map((t: { done: boolean; doneAt?: Date | null }) => ({ ...t, doneAt: t.done ? t.doneAt ?? new Date() : null }));
    return body;
  },
}));

const sessionBody = z.object({
  date: dayKeySchema,
  minutes: z.number().int().min(1).max(720),
  path: objectId.nullable().default(null),
  topic: z.string().max(120).default(''),
  mode: z.enum(['pomodoro', 'timer', 'manual']).default('manual'),
  kind: z.enum(['study', 'practice', 'project']).default('study'),
  notes: z.string().max(2000).default(''),
});
r.use('/sessions', crudRouter({ model: StudySessionModel, create: sessionBody, dateField: 'date', filters: ['kind', 'path'], searchFields: ['topic', 'notes'], sort: { date: -1, createdAt: -1 } }));

const projectBody = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().max(1000).default(''),
  status: z.enum(['idea', 'building', 'done', 'paused']).default('idea'),
  techStack: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  repoUrl: z.union([z.string().url().max(300), z.literal('')]).default(''),
  progress: z.number().int().min(0).max(100).default(0),
});
r.use('/projects', crudRouter({ model: ProjectModel, create: projectBody, filters: ['status'], sort: { updatedAt: -1 } }));

/** Today/week minutes, 90-day roadmap progress and daily series for charts. */
r.get('/summary', asyncHandler(async (req, res) => {
  const uid = req.user!.id;
  const today = await userToday(uid);
  const days = lastNDays(today, 7);
  const [paths, series, profile] = await Promise.all([
    LearningPathModel.find({ user: uid, archived: false }).sort({ order: 1 }).lean(),
    StudySessionModel.aggregate<{ _id: string; minutes: number }>([
      { $match: { user: new Types.ObjectId(uid), date: { $gte: days[0], $lte: today } } },
      { $group: { _id: '$date', minutes: { $sum: '$minutes' } } },
    ]),
    UserProfileModel.findOne({ user: uid }).select('targets.studyMinutesPerDay').lean(),
  ]);
  const map = new Map(series.map((s) => [s._id, s.minutes]));
  const weekly = days.map((d) => ({ date: d, minutes: map.get(d) ?? 0 }));
  const totalTopics = paths.reduce((s, p) => s + p.topics.length, 0);
  const doneTopics = paths.reduce((s, p) => s + p.topics.filter((t) => t.done).length, 0);
  const starts = paths.map((p) => p.startDate).filter(Boolean).sort() as string[];
  const roadmapDay = starts.length ? Math.max(0, Math.round((Date.parse(today) - Date.parse(starts[0])) / 86400000) + 1) : null;
  ok(res, {
    todayMinutes: map.get(today) ?? 0,
    weekMinutes: weekly.reduce((s, d) => s + d.minutes, 0),
    targetMinutes: profile?.targets?.studyMinutesPerDay ?? 0,
    weekly,
    roadmap: { totalTopics, doneTopics, pct: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0, day: roadmapDay },
    paths: paths.map((p) => ({ _id: p._id, title: p.title, total: p.topics.length, done: p.topics.filter((t) => t.done).length, proficiency: p.proficiency })),
  });
}));

export default r;
