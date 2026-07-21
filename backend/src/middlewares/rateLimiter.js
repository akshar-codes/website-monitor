import rateLimit from "express-rate-limit";
import env from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

const rateLimitHandler = (_req, res) => {
  sendError(res, {
    statusCode: 429,
    message: "Too many requests. Please slow down and try again later.",
  });
};

/**
 * Global request-flooding guard, applied to every route. Keyed on the
 * client IP by default (respects `app.set("trust proxy", ...)`).
 */
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Factory for sensitive-auth-endpoint limiters. Each call returns an
 * independent limiter instance with its own counter bucket, so traffic
 * against one endpoint category (login, verification, password reset,
 * OAuth initiation) never eats into another's quota — while the shared
 * config lives in exactly one place instead of being copy-pasted per
 * limiter.
 */
const createAuthRateLimiter = (overrides = {}) =>
  rateLimit({
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    ...overrides,
  });

/**
 * Rate limiter for /auth/login, /auth/register, and the OAuth-initiation
 * endpoints. Successful requests don't count against the quota so a
 * legitimate user isn't penalised by their own successful logins.
 */
export const authLimiter = createAuthRateLimiter({
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for the email-verification endpoints.
 */
export const verificationLimiter = createAuthRateLimiter();

/**
 * Rate limiter for the password-reset endpoints.
 */
export const passwordResetLimiter = createAuthRateLimiter();

export default globalLimiter;
