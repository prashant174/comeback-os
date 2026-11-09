const log = (level, msg, meta) => {
    if (process.env.NODE_ENV === 'test' && level !== 'error')
        return;
    const line = { t: new Date().toISOString(), level, msg, ...(meta ? { meta } : {}) };
    (level === 'error' ? console.error : console.log)(JSON.stringify(line));
};
export const logger = {
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
    debug: (m, meta) => log('debug', m, meta),
};
//# sourceMappingURL=logger.js.map