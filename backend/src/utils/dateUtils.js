/**
 * Return midnight UTC for today — used as the DailyStat document key.
 */
export const todayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Return the start of the UTC day for an arbitrary date.
 */
export const startOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Return the end of the UTC day for an arbitrary date.
 */
export const endOfDayUTC = (date) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};

/**
 * Return a Date that is `ms` milliseconds before now.
 */
export const msBefore = (ms) => new Date(Date.now() - ms);

/**
 * True when a timestamp is older than `intervalSeconds * staleMultiplier`.
 */
export const isStale = (checkedAt, intervalSeconds, staleMultiplier = 2) => {
  if (!checkedAt || !intervalSeconds) return true;
  const ageMs = Date.now() - new Date(checkedAt).getTime();
  const staleThresholdMs = intervalSeconds * staleMultiplier * 1000;
  return ageMs > staleThresholdMs;
};

/**
 * Inclusive day-span between two dates, counted in whole UTC calendar
 * days (e.g. the same day = 1, a full week apart = 8). Used by the
 * monitor analytics endpoint to:
 */
export const daysBetween = (start, end) => {
  const startMs = startOfDayUTC(start).getTime();
  const endMs = endOfDayUTC(end).getTime();
  return Math.max(1, Math.ceil((endMs - startMs) / (24 * 60 * 60 * 1000)));
};
