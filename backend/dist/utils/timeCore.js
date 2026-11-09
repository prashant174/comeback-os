export const toMinutesSafe = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
/** Minutes between bedtime and wake time, crossing midnight if needed. */
export const sleepDuration = (bed, wake) => {
    const b = toMinutesSafe(bed);
    const w = toMinutesSafe(wake);
    return w > b ? w - b : 1440 - b + w;
};
export const round1 = (n) => Math.round(n * 10) / 10;
//# sourceMappingURL=timeCore.js.map