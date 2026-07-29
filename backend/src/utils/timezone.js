/**
 * True when `tz` is a value Node's Intl implementation recognises as a
 * valid IANA timezone identifier (e.g. "America/New_York", "UTC").
 * `Intl.DateTimeFormat` throws a RangeError for anything it doesn't
 * recognise, which is the only reliable cross-platform way to validate a
 * timezone string without shipping a static IANA database as a dependency.
 */
export const isValidTimezone = (tz) => {
  if (typeof tz !== "string" || !tz.trim()) return false;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
