import env from "./env.js";
import ApiError from "../utils/ApiError.js";

const allowedOrigins = env.CORS_ORIGINS;

/**
 * Whitelist-based CORS policy.
 */
const corsOptions = {
  origin(origin, callback) {
    // Requests with no Origin header (curl, server-to-server calls, health
    // checks, same-origin requests) aren't subject to CORS — always allow.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      ApiError.forbidden(`Origin "${origin}" is not allowed by CORS policy`),
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

export default corsOptions;
