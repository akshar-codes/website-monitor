const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");

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

module.exports = app;
