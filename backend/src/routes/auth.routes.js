/**
 * Authentication routes
 *
 * POST /api/auth/register — create an account (auto-logs in)
 * POST /api/auth/login    — authenticate with email + password
 * POST /api/auth/logout   — destroy the current session
 * GET  /api/auth/me       — return the authenticated user
 */

import { Router } from "express";
import {
  register,
  login,
  logout,
  getMe,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { authLimiter } from "../middlewares/rateLimiter.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  validate(registerSchema, "body"),
  register,
);
router.post("/login", authLimiter, validate(loginSchema, "body"), login);
router.post("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, getMe);

export default router;
