import rateLimit from "express-rate-limit";
import env from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";

/**
 * Global request-flooding guard, applied to every route. Keyed on the
 */
const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, {
      statusCode: 429,
      message: "Too many requests. Please slow down and try again later.",
    });
  },
});

export default globalLimiter;
