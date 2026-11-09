import { UserProfileModel } from '../models/UserProfile.js';
import { dayKey } from '../utils/date.js';

/** Today's YYYY-MM-DD in the user's configured timezone. */
export async function userToday(userId: string) {
  const p = await UserProfileModel.findOne({ user: userId }).select('personal.timezone').lean();
  return dayKey(new Date(), p?.personal?.timezone || 'Asia/Kolkata');
}
