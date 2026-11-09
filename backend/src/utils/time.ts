import { toMinutesSafe } from './timeCore.js';
export { toMinutesSafe };

/** Current HH:MM and weekday in a timezone. */
export function nowIn(timeZone: string, d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hh = String(Number(get('hour')) % 24).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { hhmm: `${hh}:${get('minute')}`, minutes: Number(hh) * 60 + Number(get('minute')), weekday: days.indexOf(get('weekday')) };
}
