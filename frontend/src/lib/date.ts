export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** "06:15" → "6:15 AM" */
export const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
};

/** Current minutes-since-midnight in a timezone */
export const nowMinutesIn = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
};

export const greetingFor = (minutes: number) =>
  minutes < 12 * 60 ? 'Good morning' : minutes < 17 * 60 ? 'Good afternoon' : 'Good evening';

export const prettyDate = (key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(key + 'T00:00:00').toLocaleDateString('en-IN', opts);

export const shortDay = (key: string) => new Date(key + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });

/** YYYY-MM-DD for "now" in a timezone */
export const todayIn = (timeZone = 'Asia/Kolkata') =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const addDays = (key: string, n: number) => {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const weekdayOf = (key: string) => new Date(key + 'T00:00:00Z').getUTCDay();
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const monthLabel = (ym: string) => new Date(ym + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
export const fmtMinutes = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 ? `${min % 60}m` : ''}`.trim() : `${min}m`);
