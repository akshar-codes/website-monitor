import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import env from "./config/env.js";
import routes from "./routes/index.js";
import notFound from "./middlewares/notFound.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

// ── Security ──
app.use(helmet());
app.use(
  cors({
    origin: env.isDev ? "*" : [], // lock down in production
    credentials: true,
  }),
);

// ── Rate limiting ──
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, slow down." },
  }),
);

// ── Body parsing ──
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Routes ──
app.use("/api", routes);

// ── Error handling (must be last) ──
app.use(notFound);
app.use(errorHandler);

export default app;
