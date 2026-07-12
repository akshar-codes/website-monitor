
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
