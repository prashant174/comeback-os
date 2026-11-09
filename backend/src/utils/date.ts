/**
 * Date helpers. All "day" keys are YYYY-MM-DD strings computed in the user's
 * timezone so a log at 11:30 PM IST doesn't land on the wrong day.
 */
export function dayKey(date: Date = new Date(), timeZone = 'Asia/Kolkata'): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function isValidDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  // round-trip check rejects impossible dates like 2026-02-31 that V8 silently rolls over
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** Returns the N day keys ending at `endKey` (inclusive), oldest first. */
export function lastNDays(endKey: string, n: number): string[] {
  const end = new Date(endKey + 'T00:00:00Z');
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function shiftDay(key: string, delta: number): string {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday for a YYYY-MM-DD key */
export function weekdayOf(key: string): number {
  return new Date(key + 'T00:00:00Z').getUTCDay();
}
