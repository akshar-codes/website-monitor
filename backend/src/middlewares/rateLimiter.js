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

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitHandler,
});

/**
 * Rate limiter for the email-verification endpoints. Unlike `authLimiter`,
 * this does NOT skip successful requests: /resend-verification always
 * responds 200 (by design, to avoid account enumeration), so a limiter
 * that only counts failures would never actually throttle it and the
 * endpoint could be used to spam a mailbox.
 */
export const verificationLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export default globalLimiter;
