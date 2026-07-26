/**
 * Escapes regex-special characters so untrusted input can be safely
 * interpolated into a `new RegExp(...)` pattern (e.g. the admin user
 * search filter in services/admin.service.js). Without this, characters
 * like `.`, `*`, `(`, `|` in a search term would be interpreted as regex
 * syntax instead of literal text, and could be used to build
 * catastrophic-backtracking patterns against the database.
 */
export const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
