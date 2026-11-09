import { Schema, model, Types } from 'mongoose';
const topicSchema = new Schema({
    title: { type: String, required: true, maxlength: 120 },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 2000 },
    subtopics: { type: [{ title: { type: String, maxlength: 120 }, done: { type: Boolean, default: false } }], default: [] },
});
const resourceSchema = new Schema({
    title: { type: String, required: true, maxlength: 120 },
    url: { type: String, required: true, maxlength: 500 },
    kind: { type: String, enum: ['article', 'video', 'course', 'docs', 'other'], default: 'other' },
});
const learningPathSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    order: { type: Number, default: 0 },
    startDate: { type: String, default: null },
    targetDate: { type: String, default: null },
    proficiency: { type: Number, min: 0, max: 5, default: 0 },
    topics: { type: [topicSchema], default: [] },
    resources: { type: [resourceSchema], default: [] },
    archived: { type: Boolean, default: false },
}, { timestamps: true });
export const LearningPathModel = model('LearningPath', learningPathSchema);
const studySessionSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    minutes: { type: Number, min: 1, max: 720, required: true },
    path: { type: Types.ObjectId, ref: 'LearningPath', default: null },
    topic: { type: String, default: '', maxlength: 120 },
    mode: { type: String, enum: ['pomodoro', 'timer', 'manual'], default: 'manual' },
    kind: { type: String, enum: ['study', 'practice', 'project'], default: 'study' },
    notes: { type: String, default: '', maxlength: 2000 },
}, { timestamps: true });
studySessionSchema.index({ user: 1, date: -1 });
export const StudySessionModel = model('StudySession', studySessionSchema);
const projectSchema = new Schema({
    user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['idea', 'building', 'done', 'paused'], default: 'idea' },
    techStack: { type: [String], default: [] },
    repoUrl: { type: String, default: '', maxlength: 300 },
    progress: { type: Number, min: 0, max: 100, default: 0 },
}, { timestamps: true });
export const ProjectModel = model('Project', projectSchema);
//# sourceMappingURL=learning.js.map