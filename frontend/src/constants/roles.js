/**
 * Application-level roles — mirrors backend/src/config/constants.js.
 * Kept separate from any future subscription/plan concept; see the
 * backend constants file for the full rationale.
 */
export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});
