/* Minimal structured logger. Swap for pino/winston later without touching callers. */
type Level = 'info' | 'warn' | 'error' | 'debug';
const log = (level: Level, msg: string, meta?: unknown) => {
  if (process.env.NODE_ENV === 'test' && level !== 'error') return;
  const line = { t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
  (level === 'error' ? console.error : console.log)(JSON.stringify(line));
};
export const logger = {
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
};
