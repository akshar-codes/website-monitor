import env from "./env.js";

/**
 * Centralised secure cookie defaults, ready for the upcoming Passport /
 */
export const secureCookieOptions = (overrides = {}) => ({
  httpOnly: true,
  secure: env.isProd, // requires HTTPS — only enforce once actually served over it
  sameSite: env.isProd ? "strict" : "lax",
  signed: true,
  path: "/",
  ...overrides,
});
