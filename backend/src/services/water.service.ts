import { Types } from 'mongoose';
import { WaterLogModel } from '../models/WaterLog.js';

export async function waterForDay(userId: string, date: string) {
  const entries = await WaterLogModel.find({ user: userId, date }).sort({ loggedAt: -1 }).lean();
  const totalMl = entries.reduce((s, e) => s + e.amountMl, 0);
  return { date, totalMl, entries };
}

export async function waterHistory(userId: string, days: string[]) {
  const rows = await WaterLogModel.aggregate<{ _id: string; totalMl: number }>([
    { $match: { user: new Types.ObjectId(userId), date: { $gte: days[0], $lte: days[days.length - 1] } } },
    { $group: { _id: '$date', totalMl: { $sum: '$amountMl' } } },
  ]);
  const map = new Map(rows.map((r) => [r._id, r.totalMl]));
  return days.map((date) => ({ date, totalMl: map.get(date) ?? 0 }));
}
