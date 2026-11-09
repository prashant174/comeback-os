import { Types } from 'mongoose';
import { dailyCompletion } from './habit.service.js';
import { waterHistory } from './water.service.js';
import { nutritionSeries } from './nutrition.service.js';
import { SleepRecordModel, JournalModel, GoalModel } from '../models/wellbeing.js';
import { StudySessionModel } from '../models/learning.js';
import { WorkoutLogModel, BodyMeasurementModel } from '../models/fitness.js';
import { ExpenseModel } from '../models/finance.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { round1 } from '../utils/timeCore.js';
const byDate = (rows) => new Map(rows.map((r) => [r._id, r]));
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
export async function analytics(userId, days) {
    const uid = new Types.ObjectId(userId);
    const range = { $gte: days[0], $lte: days[days.length - 1] };
    const [habits, water, nutrition, sleep, study, workouts, expensesDay, expensesCat, weight, mood, goals, profile] = await Promise.all([
        dailyCompletion(userId, days),
        waterHistory(userId, days),
        nutritionSeries(userId, days),
        SleepRecordModel.find({ user: uid, date: range }).select('date durationMin quality').lean(),
        StudySessionModel.aggregate([{ $match: { user: uid, date: range } }, { $group: { _id: '$date', minutes: { $sum: '$minutes' } } }]),
        WorkoutLogModel.aggregate([{ $match: { user: uid, date: range, completed: true } }, { $group: { _id: '$date', count: { $sum: 1 }, minutes: { $sum: '$durationMin' } } }]),
        ExpenseModel.aggregate([{ $match: { user: uid, date: range } }, { $group: { _id: '$date', total: { $sum: '$amount' } } }]),
        ExpenseModel.aggregate([{ $match: { user: uid, date: range } }, { $group: { _id: '$category', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
        BodyMeasurementModel.find({ user: uid, date: range, weightKg: { $ne: null } }).sort({ date: 1 }).select('date weightKg waistCm').lean(),
        JournalModel.aggregate([{ $match: { user: uid, date: range } }, { $group: { _id: '$date', mood: { $avg: '$mood' } } }]),
        GoalModel.find({ user: uid }).select('title status progress deadline horizon category').lean(),
        UserProfileModel.findOne({ user: uid }).select('targets').lean(),
    ]);
    const t = profile?.targets;
    const sleepMap = new Map(sleep.map((s) => [s.date, s]));
    const studyMap = byDate(study), woMap = byDate(workouts), exMap = byDate(expensesDay), moodMap = byDate(mood);
    const series = days.map((date, i) => ({
        date,
        habitPct: Math.round(habits[i].ratio * 100),
        waterMl: water[i].totalMl,
        protein: nutrition[i].protein,
        kcal: nutrition[i].kcal,
        sleepHours: sleepMap.has(date) ? round1(sleepMap.get(date).durationMin / 60) : null,
        studyMin: studyMap.get(date)?.minutes ?? 0,
        workouts: woMap.get(date)?.count ?? 0,
        workoutMin: woMap.get(date)?.minutes ?? 0,
        spent: Math.round((exMap.get(date)?.total ?? 0) * 100) / 100,
        mood: moodMap.has(date) ? round1(moodMap.get(date).mood) : null,
    }));
    const n = days.length;
    const loggedProtein = series.filter((s) => s.protein > 0);
    const sleepLogged = series.filter((s) => s.sleepHours !== null);
    const kpis = {
        days: n,
        habitConsistency: Math.round(avg(series.map((s) => s.habitPct))),
        waterDaysOnTarget: t?.waterMl ? series.filter((s) => s.waterMl >= t.waterMl).length : 0,
        avgWaterMl: Math.round(avg(series.map((s) => s.waterMl))),
        proteinDaysOnTarget: t?.proteinMinG ? series.filter((s) => s.protein >= t.proteinMinG).length : 0,
        avgProtein: round1(avg(loggedProtein.map((s) => s.protein))),
        proteinDaysLogged: loggedProtein.length,
        avgSleepHours: round1(avg(sleepLogged.map((s) => s.sleepHours))),
        sleepNightsLogged: sleepLogged.length,
        studyHours: round1(series.reduce((s, x) => s + x.studyMin, 0) / 60),
        workouts: series.reduce((s, x) => s + x.workouts, 0),
        workoutDays: series.filter((s) => s.workouts > 0).length,
        spent: Math.round(series.reduce((s, x) => s + x.spent, 0) * 100) / 100,
        avgMood: round1(avg(series.filter((s) => s.mood !== null).map((s) => s.mood))),
        weightChangeKg: weight.length >= 2 ? round1(weight[weight.length - 1].weightKg - weight[0].weightKg) : null,
        goalsActive: goals.filter((g) => g.status === 'active').length,
        goalsCompleted: goals.filter((g) => g.status === 'completed').length,
        goalsAvgProgress: Math.round(avg(goals.filter((g) => g.status !== 'dropped').map((g) => g.progress))),
    };
    return {
        from: days[0], to: days[n - 1], targets: t, kpis, series,
        expensesByCategory: expensesCat.map((c) => ({ category: c._id, total: Math.round(c.total * 100) / 100 })),
        weight: weight.map((w) => ({ date: w.date, weightKg: w.weightKg, waistCm: w.waistCm })),
        goals: goals.map((g) => ({ _id: g._id, title: g.title, status: g.status, progress: g.progress, deadline: g.deadline })),
    };
}
//# sourceMappingURL=analytics.service.js.map