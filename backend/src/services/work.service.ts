import { Types } from 'mongoose';
import {
  ChangeLogModel, MeetingModel, RequirementModel, StakeholderModel, WorkLogModel, WorkProjectModel, WorkTaskModel,
} from '../models/work.js';
import { UserPreferenceModel } from '../models/UserPreference.js';
import { ApiError } from '../utils/ApiError.js';
import { shiftDay, weekdayOf } from '../utils/date.js';
import { userToday } from './userContext.service.js';

type Id = string | Types.ObjectId | null | undefined;

/** Every referenced id must belong to the same user — blocks linking someone else's project/stakeholder. */
export async function assertOwned(userId: string, refs: { project?: Id; task?: Id; stakeholder?: Id; stakeholders?: Id[] }) {
  const check = async (Model: typeof WorkProjectModel | typeof WorkTaskModel | typeof StakeholderModel, ids: Id[], label: string) => {
    const list = ids.filter(Boolean).map(String);
    if (!list.length) return;
    const n = await (Model as typeof WorkProjectModel).countDocuments({ _id: { $in: list }, user: userId });
    if (n !== new Set(list).size) throw ApiError.badRequest(`${label} not found`);
  };
  await check(WorkProjectModel, [refs.project], 'Project');
  await check(WorkTaskModel, [refs.task], 'Task');
  await check(StakeholderModel, [refs.stakeholder, ...(refs.stakeholders ?? [])], 'Stakeholder');
}

/** Status rules: "blocked" needs a reason; "done" stamps completion (in the user's timezone). */
export async function applyTaskRules(userId: string, body: Record<string, unknown>, existing?: { status?: string; blockedReason?: string; completedAt?: Date | null }) {
  const status = (body.status ?? existing?.status) as string | undefined;
  if (status === 'blocked') {
    const reason = String(body.blockedReason ?? existing?.blockedReason ?? '').trim();
    if (!reason) throw ApiError.badRequest('Add a reason when marking a task as blocked');
  }
  if (body.status !== undefined && body.status !== existing?.status) {
    if (body.status === 'done') { body.completedAt = new Date(); body.completedDate = await userToday(userId); }
    else { body.completedAt = null; body.completedDate = null; }
    if (body.status !== 'blocked' && body.blockedReason === undefined) body.blockedReason = '';
  }
  return body;
}

export async function createLinkedTask(userId: string, data: { title: string; project?: Id; priority?: string; dueDate?: string | null; assignee?: string; description?: string; source: { kind: 'requirement' | 'meeting'; id: Types.ObjectId } }) {
  return WorkTaskModel.create({ user: userId, status: 'todo', ...data, project: data.project ?? null });
}

/** Board: open tasks + tasks finished in the last 7 days, optionally narrowed. */
export async function boardTasks(userId: string, view: 'all' | 'today' | 'overdue' | 'week', project?: string) {
  const today = await userToday(userId);
  const filter: Record<string, unknown> = { user: userId };
  if (project) filter.project = project;
  if (view === 'today') Object.assign(filter, { status: { $ne: 'done' }, dueDate: today });
  else if (view === 'overdue') Object.assign(filter, { status: { $ne: 'done' }, dueDate: { $lt: today, $ne: null } });
  else if (view === 'week') Object.assign(filter, { status: { $ne: 'done' }, dueDate: { $gte: today, $lte: shiftDay(today, 6) } });
  else filter.$or = [{ status: { $ne: 'done' } }, { completedDate: { $gte: shiftDay(today, -7) } }];
  const tasks = await WorkTaskModel.find(filter).sort({ order: 1, dueDate: 1, createdAt: 1 }).populate('project', 'name').lean();
  return { today, tasks };
}

export async function workDay(userId: string, date: string) {
  const [logs, done] = await Promise.all([
    WorkLogModel.find({ user: userId, date }).sort({ createdAt: 1 }).populate('project', 'name').lean(),
    WorkTaskModel.find({ user: userId, completedDate: date }).populate('project', 'name').select('title project').lean(),
  ]);
  return { date, logs, doneTasks: done, totalMinutes: logs.reduce((s, l) => s + l.minutes, 0) };
}

export async function hoursByProject(userId: string, from: string, to: string) {
  const rows = await WorkLogModel.aggregate<{ _id: Types.ObjectId | null; minutes: number }>([
    { $match: { user: new Types.ObjectId(userId), date: { $gte: from, $lte: to } } },
    { $group: { _id: '$project', minutes: { $sum: '$minutes' } } },
    { $sort: { minutes: -1 } },
  ]);
  const projects = await WorkProjectModel.find({ _id: { $in: rows.map((r) => r._id).filter(Boolean) } }).select('name').lean();
  const name = new Map(projects.map((p) => [String(p._id), p.name]));
  return rows.map((r) => ({ project: r._id ? String(r._id) : null, name: r._id ? name.get(String(r._id)) ?? 'Deleted project' : 'No project', minutes: r.minutes }));
}

/** Dashboard widget data. */
export async function workSummary(userId: string, today: string) {
  const open = { user: userId, status: { $ne: 'done' } };
  const [dueToday, overdue, blocked, logs] = await Promise.all([
    WorkTaskModel.find({ ...open, dueDate: today }).sort({ priority: -1 }).limit(5).populate('project', 'name').select('title priority status project dueDate').lean(),
    WorkTaskModel.find({ ...open, dueDate: { $lt: today, $ne: null } }).sort({ dueDate: 1 }).limit(5).populate('project', 'name').select('title priority status project dueDate').lean(),
    WorkTaskModel.countDocuments({ user: userId, status: 'blocked' }),
    WorkLogModel.find({ user: userId, date: today }).select('minutes').lean(),
  ]);
  const overdueCount = await WorkTaskModel.countDocuments({ ...open, dueDate: { $lt: today, $ne: null } });
  const dueTodayCount = await WorkTaskModel.countDocuments({ ...open, dueDate: today });
  return { dueToday, overdue, dueTodayCount, overdueCount, blocked, minutesToday: logs.reduce((s, l) => s + l.minutes, 0) };
}

export async function projectSummary(userId: string, projectId: string) {
  const project = await WorkProjectModel.findOne({ _id: projectId, user: userId }).populate('stakeholders', 'name department role').lean();
  if (!project) throw ApiError.notFound('Project not found');
  const pid = new Types.ObjectId(projectId);
  const [byStatus, requirements, meetings, changes, minutes] = await Promise.all([
    WorkTaskModel.aggregate<{ _id: string; n: number }>([{ $match: { user: new Types.ObjectId(userId), project: pid } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    RequirementModel.find({ user: userId, project: pid }).sort({ date: -1 }).limit(20).lean(),
    MeetingModel.find({ user: userId, project: pid }).sort({ date: -1 }).limit(10).select('title date actionItems').lean(),
    ChangeLogModel.find({ user: userId, project: pid }).sort({ date: -1 }).limit(20).lean(),
    WorkLogModel.aggregate<{ minutes: number }>([{ $match: { user: new Types.ObjectId(userId), project: pid } }, { $group: { _id: null, minutes: { $sum: '$minutes' } } }]),
  ]);
  return {
    project,
    tasks: Object.fromEntries(['todo', 'in_progress', 'blocked', 'done'].map((s) => [s, byStatus.find((b) => b._id === s)?.n ?? 0])),
    requirements, meetings, changes,
    totalMinutes: minutes[0]?.minutes ?? 0,
  };
}

const fmtH = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const STATUS_LABEL: Record<string, string> = { planning: 'Planning', in_progress: 'In progress', on_hold: 'On hold', live: 'Live', done: 'Done' };

/** Weekly status report: structured data + a ready-to-send plain-text version. */
export async function weeklyReport(userId: string, anyDayInWeek?: string) {
  const today = await userToday(userId);
  const ref = anyDayInWeek ?? today;
  const prefs = await UserPreferenceModel.findOne({ user: userId }).select('weekStartsOn').lean();
  const startDow = prefs?.weekStartsOn ?? 1;
  const from = shiftDay(ref, -((weekdayOf(ref) - startDow + 7) % 7));
  const to = shiftDay(from, 6);
  const uid = new Types.ObjectId(userId);

  const [done, hours, delivered, received, blockers, nextWeek, changes, projects] = await Promise.all([
    WorkTaskModel.find({ user: uid, completedDate: { $gte: from, $lte: to } }).populate('project', 'name').select('title project').lean(),
    hoursByProject(userId, from, to),
    RequirementModel.find({ user: uid, status: 'delivered', updatedAt: { $gte: new Date(from + 'T00:00:00Z'), $lte: new Date(to + 'T23:59:59Z') } }).select('title requestedBy').populate('stakeholder', 'name').lean(),
    RequirementModel.countDocuments({ user: uid, date: { $gte: from, $lte: to } }),
    WorkTaskModel.find({ user: uid, status: 'blocked' }).populate('project', 'name').select('title blockedReason project').lean(),
    // still open from this week + the 7 days after it: what the reader cares about mid-week
    WorkTaskModel.find({ user: uid, status: { $ne: 'done' }, dueDate: { $gte: from, $lte: shiftDay(to, 7) } }).sort({ dueDate: 1 }).populate('project', 'name').select('title dueDate project status').lean(),
    ChangeLogModel.find({ user: uid, date: { $gte: from, $lte: to } }).sort({ date: 1 }).populate('project', 'name').lean(),
    WorkProjectModel.find({ user: uid, archived: false, status: { $in: ['planning', 'in_progress', 'on_hold', 'live'] } }).select('name status progress targetDate').lean(),
  ]);
  const pname = (p: unknown) => (p as { name?: string } | null)?.name;
  const totalMinutes = hours.reduce((s, h) => s + h.minutes, 0);

  const lines: string[] = [];
  lines.push(`Weekly status — ${from} to ${to}`, '');
  lines.push(`Completed (${done.length})`);
  done.forEach((t) => lines.push(`• ${t.title}${pname(t.project) ? ` [${pname(t.project)}]` : ''}`));
  if (!done.length) lines.push('• —');
  lines.push('', 'Projects');
  projects.forEach((p) => lines.push(`• ${p.name} — ${STATUS_LABEL[p.status]}, ${p.progress}%${p.targetDate ? `, target ${p.targetDate}` : ''}`));
  if (!projects.length) lines.push('• —');
  if (delivered.length) {
    lines.push('', `Requirements delivered (${delivered.length})`);
    delivered.forEach((r) => lines.push(`• ${r.title}${pname(r.stakeholder) || r.requestedBy ? ` — for ${pname(r.stakeholder) ?? r.requestedBy}` : ''}`));
  }
  if (changes.length) {
    lines.push('', 'Releases / changes');
    changes.forEach((c) => lines.push(`• ${c.date} ${pname(c.project) ?? ''}${c.version ? ` ${c.version}` : ''} (${c.environment.toUpperCase()}): ${c.summary}`));
  }
  lines.push('', 'Blockers');
  blockers.forEach((b) => lines.push(`• ${b.title}${pname(b.project) ? ` [${pname(b.project)}]` : ''} — ${b.blockedReason}`));
  if (!blockers.length) lines.push('• None');
  lines.push('', 'Open / coming up');
  nextWeek.forEach((t) => lines.push(`• ${t.title}${pname(t.project) ? ` [${pname(t.project)}]` : ''} (due ${t.dueDate}${t.dueDate! < today && t.status !== 'done' ? ', overdue' : ''}${t.status === 'in_progress' ? ', in progress' : ''})`));
  if (!nextWeek.length) lines.push('• —');
  if (totalMinutes) {
    lines.push('', `Time logged: ${fmtH(totalMinutes)}`);
    hours.forEach((h) => lines.push(`• ${h.name}: ${fmtH(h.minutes)}`));
  }

  return { from, to, done, hours, totalMinutes, delivered, receivedCount: received, blockers, nextWeek, changes, projects, text: lines.join('\n') };
}
