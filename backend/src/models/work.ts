import { Schema, model } from 'mongoose';

const ObjectId = Schema.Types.ObjectId;

/*
 * Work module — a private project tracker per user.
 * Deliberately has NO fields for credentials, contact numbers or file uploads:
 * the app is meant to hold "what I'm working on", not company data.
 */

const day = { type: String, match: /^\d{4}-\d{2}-\d{2}$/ };
const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;

export const PROJECT_STATUS = ['planning', 'in_progress', 'on_hold', 'live', 'done'] as const;
export const TASK_STATUS = ['todo', 'in_progress', 'blocked', 'done'] as const;
export const REQ_STATUS = ['new', 'accepted', 'in_progress', 'delivered', 'rejected'] as const;
export const CHANGE_TYPES = ['feature', 'fix', 'config', 'data'] as const;
export const ENVIRONMENTS = ['dev', 'uat', 'live'] as const;

const stakeholderSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 80 },
    department: { type: String, default: '', maxlength: 60 },
    role: { type: String, default: '', maxlength: 60 },
    note: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: true },
);
export const StakeholderModel = model('Stakeholder', stakeholderSchema);

const workProjectSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 2000 },
    department: { type: String, default: '', maxlength: 60 },
    stakeholders: { type: [{ type: ObjectId, ref: 'Stakeholder' }], default: [] },
    status: { type: String, enum: [...PROJECT_STATUS], default: 'planning' },
    priority: { type: String, enum: [...PRIORITY], default: 'medium' },
    startDate: { ...day, default: null },
    targetDate: { ...day, default: null },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    links: { type: [{ label: { type: String, maxlength: 60 }, url: { type: String, maxlength: 500 }, _id: false }], default: [] },
    techStack: { type: [String], default: [] },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
workProjectSchema.index({ user: 1, archived: 1, status: 1 });
export const WorkProjectModel = model('WorkProject', workProjectSchema);

const workTaskSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'WorkProject', default: null },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 3000 },
    status: { type: String, enum: [...TASK_STATUS], default: 'todo' },
    blockedReason: { type: String, default: '', maxlength: 300 },
    priority: { type: String, enum: [...PRIORITY], default: 'medium' },
    dueDate: { ...day, default: null },
    checklist: { type: [{ title: { type: String, maxlength: 200 }, done: { type: Boolean, default: false } }], default: [] },
    estimateHours: { type: Number, min: 0, max: 1000, default: null },
    assignee: { type: String, default: 'me', maxlength: 60 }, // "me" or a name (meeting action items)
    order: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
    completedDate: { ...day, default: null }, // user-timezone day it was completed (for logs/reports)
    source: {
      kind: { type: String, enum: ['manual', 'requirement', 'meeting'], default: 'manual' },
      id: { type: ObjectId, default: null },
    },
  },
  { timestamps: true },
);
workTaskSchema.index({ user: 1, status: 1, dueDate: 1 });
workTaskSchema.index({ user: 1, project: 1 });
workTaskSchema.index({ user: 1, completedDate: 1 });
export const WorkTaskModel = model('WorkTask', workTaskSchema);

const requirementSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'WorkProject', default: null },
    stakeholder: { type: ObjectId, ref: 'Stakeholder', default: null },
    requestedBy: { type: String, default: '', maxlength: 80 }, // free text when not a saved stakeholder
    department: { type: String, default: '', maxlength: 60 },
    title: { type: String, required: true, maxlength: 200 },
    details: { type: String, default: '', maxlength: 3000 },
    date: { ...day, required: true },
    priority: { type: String, enum: [...PRIORITY], default: 'medium' },
    status: { type: String, enum: [...REQ_STATUS], default: 'new' },
    task: { type: ObjectId, ref: 'WorkTask', default: null },
  },
  { timestamps: true },
);
requirementSchema.index({ user: 1, status: 1, date: -1 });
export const RequirementModel = model('Requirement', requirementSchema);

const actionItemSchema = new Schema({
  text: { type: String, required: true, maxlength: 300 },
  assignee: { type: String, default: 'me', maxlength: 60 },
  dueDate: { ...day, default: null },
  task: { type: ObjectId, ref: 'WorkTask', default: null },
});
const meetingSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'WorkProject', default: null },
    title: { type: String, required: true, maxlength: 150 },
    date: { ...day, required: true },
    attendees: { type: [{ type: ObjectId, ref: 'Stakeholder' }], default: [] },
    notes: { type: String, default: '', maxlength: 10000 },
    decisions: { type: String, default: '', maxlength: 3000 },
    actionItems: { type: [actionItemSchema], default: [] },
  },
  { timestamps: true },
);
meetingSchema.index({ user: 1, date: -1 });
export const MeetingModel = model('Meeting', meetingSchema);

const workLogSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    date: { ...day, required: true },
    project: { type: ObjectId, ref: 'WorkProject', default: null },
    task: { type: ObjectId, ref: 'WorkTask', default: null },
    description: { type: String, required: true, maxlength: 500 },
    minutes: { type: Number, min: 1, max: 1440, required: true },
  },
  { timestamps: true },
);
workLogSchema.index({ user: 1, date: -1 });
export const WorkLogModel = model('WorkLog', workLogSchema);

const changeLogSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'WorkProject', required: true },
    date: { ...day, required: true },
    version: { type: String, default: '', maxlength: 30 },
    type: { type: String, enum: [...CHANGE_TYPES], default: 'feature' },
    environment: { type: String, enum: [...ENVIRONMENTS], default: 'live' },
    summary: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: true },
);
changeLogSchema.index({ user: 1, project: 1, date: -1 });
export const ChangeLogModel = model('ChangeLog', changeLogSchema);
