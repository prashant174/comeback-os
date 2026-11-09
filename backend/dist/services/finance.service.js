import { Types } from 'mongoose';
import { BudgetModel, ExpenseModel } from '../models/finance.js';
import { NotificationModel } from '../models/notify.js';
import { UserProfileModel } from '../models/UserProfile.js';
import { round1 } from '../utils/timeCore.js';
export const monthRange = (month) => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, days: last };
};
const r2 = (n) => Math.round(n * 100) / 100;
export async function financeSummary(userId, month) {
    const { from, to, days } = monthRange(month);
    const uid = new Types.ObjectId(userId);
    const [budget, byCat, byDay, profile, history] = await Promise.all([
        BudgetModel.findOne({ user: userId }).lean(),
        ExpenseModel.aggregate([
            { $match: { user: uid, date: { $gte: from, $lte: to } } },
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        ExpenseModel.aggregate([
            { $match: { user: uid, date: { $gte: from, $lte: to } } },
            { $group: { _id: '$date', total: { $sum: '$amount' } } },
        ]),
        UserProfileModel.findOne({ user: userId }).select('personal.monthlyBudget').lean(),
        ExpenseModel.aggregate([
            { $match: { user: uid } },
            { $group: { _id: { $substrBytes: ['$date', 0, 7] }, total: { $sum: '$amount' } } },
            { $sort: { _id: -1 } }, { $limit: 7 },
        ]),
    ]);
    const cats = budget?.categories ?? [];
    const spentMap = new Map(byCat.map((c) => [c._id, c.total]));
    const categories = [
        ...cats.map((c) => ({ name: c.name, limit: c.limit, spent: r2(spentMap.get(c.name) ?? 0) })),
        ...byCat.filter((c) => !cats.some((b) => b.name === c._id)).map((c) => ({ name: c._id, limit: 0, spent: r2(c.total) })),
    ].map((c) => ({ ...c, remaining: r2(c.limit - c.spent), pct: c.limit ? Math.round((c.spent / c.limit) * 100) : null }));
    const totalLimit = cats.reduce((s, c) => s + c.limit, 0) || profile?.personal?.monthlyBudget || 0;
    const spent = r2(byCat.reduce((s, c) => s + c.total, 0));
    const dayMap = new Map(byDay.map((d) => [d._id, d.total]));
    const daily = Array.from({ length: days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        return { date, total: r2(dayMap.get(date) ?? 0) };
    });
    return {
        month, totalLimit, spent, remaining: r2(totalLimit - spent),
        pct: totalLimit ? round1((spent / totalLimit) * 100) : 0,
        categories, daily, alertAtPct: budget?.alertAtPct ?? 90,
        /** savings tracker: budget left over per month (positive = saved vs budget) */
        history: history.reverse().map((h) => ({ month: h._id, spent: r2(h.total), saved: r2(totalLimit - h.total) })),
    };
}
/** Creates an in-app alert when a category (or the whole budget) crosses the alert threshold. */
export async function checkBudgetAlerts(userId, date, category) {
    const month = date.slice(0, 7);
    const s = await financeSummary(userId, month);
    const alerts = [];
    const c = s.categories.find((x) => x.name === category);
    if (c?.limit && c.pct !== null) {
        if (c.pct >= 100)
            alerts.push({ key: `budget:${month}:${category}:100`, title: `${category} budget exceeded`, body: `Spent ₹${c.spent} of ₹${c.limit} this month.` });
        else if (c.pct >= s.alertAtPct)
            alerts.push({ key: `budget:${month}:${category}:warn`, title: `${category} budget at ${c.pct}%`, body: `₹${c.remaining} left this month.` });
    }
    if (s.totalLimit && s.pct >= 100)
        alerts.push({ key: `budget:${month}:total:100`, title: 'Monthly budget exceeded', body: `Spent ₹${s.spent} of ₹${s.totalLimit}.` });
    for (const a of alerts) {
        await NotificationModel.updateOne({ user: userId, dedupeKey: a.key }, { $setOnInsert: { user: userId, dedupeKey: a.key, title: a.title, body: a.body, kind: 'budget', link: '/finance' } }, { upsert: true });
    }
}
//# sourceMappingURL=finance.service.js.map