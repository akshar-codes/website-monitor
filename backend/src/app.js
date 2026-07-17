import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import session from "express-session";

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

// ── Rate limiting ──
app.use(globalLimiter);

// ── Body parsing ──
app.use(express.json({ limit: env.MAX_BODY_SIZE }));
app.use(express.urlencoded({ extended: true, limit: env.MAX_BODY_SIZE }));

// ── Cookies ──
app.use(cookieParser(env.COOKIE_SECRET));

// ── Sessions & authentication ──
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// ── Input sanitisation ──
app.use(sanitizeRequest);

// ── Routes ──
app.use("/api", routes);

// ── Error handling (must be last) ──
app.use(notFound);
app.use(errorHandler);

export default app;
