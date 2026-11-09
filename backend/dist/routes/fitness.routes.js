import { Router } from 'express';
import { z } from 'zod';
import { BodyMeasurementModel, ExerciseModel, ProgressPhotoModel, WorkoutLogModel, WorkoutPlanModel } from '../models/fitness.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { crudRouter } from '../utils/crud.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middleware/validate.js';
import { dayKeySchema, idParam, objectId } from '../validators/common.js';
import { userToday } from '../services/userContext.service.js';
import { weekdayOf } from '../utils/date.js';
import { imageUpload } from '../middleware/upload.js';
import { deleteImage, saveImage, sendImage } from '../services/files.service.js';
const r = Router();
const exerciseBody = z.object({
    name: z.string().trim().min(1).max(80),
    muscleGroup: z.string().max(40).default('full body'),
    type: z.enum(['reps', 'time']).default('reps'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    instructions: z.string().max(1500).default(''),
    videoUrl: z.union([z.string().url().max(300), z.literal('')]).default(''),
});
r.use('/exercises', crudRouter({ model: ExerciseModel, create: exerciseBody, searchFields: ['name', 'muscleGroup'], filters: ['muscleGroup'], sort: { name: 1 } }));
/* ---- weekly plan ---- */
const planItem = z.object({
    exercise: objectId.nullable().default(null),
    name: z.string().trim().min(1).max(80),
    sets: z.number().int().min(0).max(20),
    reps: z.number().int().min(0).max(500).default(0),
    durationSec: z.number().int().min(0).max(7200).default(0),
    restSec: z.number().int().min(0).max(600).default(60),
});
r.get('/plans', asyncHandler(async (req, res) => ok(res, await WorkoutPlanModel.find({ user: req.user.id }).sort({ dayOfWeek: 1 }).lean())));
r.put('/plans/:dayOfWeek', validate({
    params: z.object({ dayOfWeek: z.coerce.number().int().min(0).max(6) }),
    body: z.object({ title: z.string().trim().min(1).max(60), focus: z.enum(['strength', 'recovery', 'conditioning', 'rest']), items: z.array(planItem).max(30) }),
}), asyncHandler(async (req, res) => {
    const plan = await WorkoutPlanModel.findOneAndUpdate({ user: req.user.id, dayOfWeek: req.params.dayOfWeek }, { $set: req.body }, { new: true, upsert: true, runValidators: true });
    ok(res, plan);
}));
/** Today's plan + whether it has been logged. */
r.get('/today', asyncHandler(async (req, res) => {
    const date = await userToday(req.user.id);
    const [plan, logs] = await Promise.all([
        WorkoutPlanModel.findOne({ user: req.user.id, dayOfWeek: weekdayOf(date) }).lean(),
        WorkoutLogModel.find({ user: req.user.id, date }).lean(),
    ]);
    ok(res, { date, plan, logs, done: logs.some((l) => l.completed) });
}));
/* ---- logs ---- */
const logBody = z.object({
    date: dayKeySchema,
    title: z.string().trim().min(1).max(60),
    durationMin: z.number().min(0).max(600).default(0),
    entries: z.array(z.object({
        exercise: objectId.nullable().default(null),
        name: z.string().min(1).max(80),
        sets: z.array(z.object({ reps: z.number().int().min(0).max(1000).default(0), durationSec: z.number().int().min(0).max(7200).default(0) })).max(30),
    })).max(30).default([]),
    completed: z.boolean().default(true),
    notes: z.string().max(1000).default(''),
});
r.use('/logs', crudRouter({ model: WorkoutLogModel, create: logBody, dateField: 'date', sort: { date: -1, createdAt: -1 } }));
/** Personal records: best single set (reps or seconds) per exercise. */
r.get('/records', asyncHandler(async (req, res) => {
    const logs = await WorkoutLogModel.find({ user: req.user.id }).select('date entries').lean();
    const best = new Map();
    for (const l of logs)
        for (const e of l.entries) {
            const cur = best.get(e.name) ?? { name: e.name, bestReps: 0, bestSec: 0, date: l.date, sessions: 0 };
            cur.sessions++;
            for (const s of e.sets) {
                if ((s.reps ?? 0) > cur.bestReps) {
                    cur.bestReps = s.reps ?? 0;
                    cur.date = l.date;
                }
                if ((s.durationSec ?? 0) > cur.bestSec) {
                    cur.bestSec = s.durationSec ?? 0;
                    cur.date = l.date;
                }
            }
            best.set(e.name, cur);
        }
    ok(res, [...best.values()].sort((a, b) => a.name.localeCompare(b.name)));
}));
/** History of one exercise (by name) — powers strength progression charts. */
r.get('/history', validate({ query: z.object({ name: z.string().min(1).max(80) }) }), asyncHandler(async (req, res) => {
    const name = req.query.name;
    const logs = await WorkoutLogModel.find({ user: req.user.id, 'entries.name': name }).sort({ date: 1 }).select('date entries').lean();
    ok(res, logs.map((l) => {
        const e = l.entries.find((x) => x.name === name);
        return {
            date: l.date,
            totalReps: e.sets.reduce((s, x) => s + (x.reps ?? 0), 0),
            totalSec: e.sets.reduce((s, x) => s + (x.durationSec ?? 0), 0),
            bestSet: Math.max(0, ...e.sets.map((x) => Math.max(x.reps ?? 0, x.durationSec ?? 0))),
            sets: e.sets.length,
        };
    }));
}));
/* ---- body measurements (latest weight is mirrored into the profile) ---- */
const opt = (min, max) => z.number().min(min).max(max).nullable().optional();
const measureBody = z.object({
    date: dayKeySchema, weightKg: opt(20, 400), waistCm: opt(0, 300), chestCm: opt(0, 300),
    armCm: opt(0, 100), thighCm: opt(0, 150), notes: z.string().max(500).default(''),
});
r.use('/measurements', crudRouter({
    model: BodyMeasurementModel, create: measureBody, dateField: 'date', sort: { date: -1 },
    afterWrite: async (_doc, req) => {
        const latest = await BodyMeasurementModel.findOne({ user: req.user.id, weightKg: { $ne: null } }).sort({ date: -1, createdAt: -1 }).lean();
        if (latest?.weightKg)
            await UserProfileModel.updateOne({ user: req.user.id }, { $set: { 'personal.currentWeightKg': latest.weightKg } });
    },
}));
/* ---- progress photos (stored on disk, served only to the owner) ---- */
r.get('/photos', asyncHandler(async (req, res) => ok(res, await ProgressPhotoModel.find({ user: req.user.id }).sort({ date: -1 }).lean())));
r.post('/photos', imageUpload.single('photo'), asyncHandler(async (req, res) => {
    if (!req.file)
        throw ApiError.badRequest('Attach an image file in the "photo" field');
    const date = dayKeySchema.safeParse(req.body.date).success ? req.body.date : await userToday(req.user.id);
    const filename = await saveImage(req.file, req.user.id);
    const doc = await ProgressPhotoModel.create({ user: req.user.id, date, filename, note: String(req.body.note ?? '').slice(0, 300) });
    created(res, doc);
}));
r.get('/photos/:id/file', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const doc = await ProgressPhotoModel.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!doc)
        throw ApiError.notFound('Photo not found');
    await sendImage(doc.filename, res);
}));
r.delete('/photos/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const doc = await ProgressPhotoModel.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!doc)
        throw ApiError.notFound('Photo not found');
    await deleteImage(doc.filename);
    ok(res, { deleted: true });
}));
export default r;
//# sourceMappingURL=fitness.routes.js.map