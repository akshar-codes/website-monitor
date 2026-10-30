import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import env from "./config/env.js";
import helmetOptions from "./config/helmet.js";
import corsOptions from "./config/cors.js";
import sessionConfig from "./config/session.js";
import passport from "./config/passport.js";
import routes from "./routes/index.js";
import requestLogger from "./middlewares/requestLogger.js";
import globalLimiter from "./middlewares/rateLimiter.js";
import sanitizeRequest from "./middlewares/sanitize.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ── Trust proxy ──
app.set("trust proxy", env.TRUST_PROXY);

// ── Security headers ──
app.use(helmet(helmetOptions));

// ── CORS ──
app.use(cors(corsOptions));

// ── Compression ──
app.use(compression());

// ── Request logging ──
app.use(requestLogger);

// ── Static file serving ──
// Locally-stored profile avatars (see middlewares/uploadAvatar.js and
// services/profile.service.js). Mounted ahead of body parsing/sessions
// since it's a plain read-only file server with no need for either.
app.use(
  "/uploads/avatars",
  express.static(path.resolve(__dirname, "..", env.AVATAR_UPLOAD_DIR)),
);

// ── Body parsing ──
app.use(express.json({
  limit: env.MAX_BODY_SIZE,
  verify(req, _res, buffer) {
    if (req.originalUrl.startsWith("/api/payments/webhook")) req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: true, limit: env.MAX_BODY_SIZE }));

// ── Cookies ──
app.use(cookieParser(env.COOKIE_SECRET));

// ── Sessions & authentication ──
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Apply the API budget after session deserialization so authenticated
// customers receive independent quotas instead of sharing one IP bucket.
app.use("/api", globalLimiter);

// ── Input sanitisation ──
app.use(sanitizeRequest);

// ── Routes ──
app.use("/api", routes);

// ── Error handling (must be last) ──
app.use(notFound);
app.use(errorHandler);

export default app;
