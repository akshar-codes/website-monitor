/**
 * Authentication routes
 *
 * POST   /api/auth/register        — create an account (auto-logs in)
 * POST   /api/auth/login           — authenticate with email + password
 * POST   /api/auth/logout          — destroy the current session
 * POST   /api/auth/logout-all      — destroy every session for this user
 * POST   /api/auth/logout-others   — destroy every session except the current one
 * GET    /api/auth/sessions        — list this user's active sessions
 * DELETE /api/auth/sessions/:id    — revoke a single other session
 * GET    /api/auth/me              — return the authenticated user
 */

import { Router } from "express";
import {
  register,
  login,
  logout,
  logoutAll,
  logoutOtherSessions,
  listSessions,
  revokeSession,
  getMe,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate, validateSessionIdParam } from "../middlewares/validate.js";
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
router.post("/logout-all", isAuthenticated, logoutAll);
router.post("/logout-others", isAuthenticated, logoutOtherSessions);
router.get("/sessions", isAuthenticated, listSessions);
router.delete(
  "/sessions/:sessionId",
  isAuthenticated,
  validateSessionIdParam("sessionId"),
  revokeSession,
);
router.get("/me", isAuthenticated, getMe);

export default router;
