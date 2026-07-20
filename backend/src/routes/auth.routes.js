/**
 * Authentication routes
 *
 * POST   /api/auth/register            — create an account (unverified; sends a verification email)
 * POST   /api/auth/verify-email        — confirm an email address using the emailed token
 * POST   /api/auth/resend-verification — re-send the verification email
 * POST   /api/auth/login               — authenticate with email + password (must be verified)
 * GET    /api/auth/google              — start Google OAuth               (see oauth.routes.js)
 * GET    /api/auth/google/callback     — Google OAuth callback            (see oauth.routes.js)
 * GET    /api/auth/github              — start GitHub OAuth               (see oauth.routes.js)
 * GET    /api/auth/github/callback     — GitHub OAuth callback            (see oauth.routes.js)
 * POST   /api/auth/logout              — destroy the current session
 * POST   /api/auth/logout-all          — destroy every session for this user
 * POST   /api/auth/logout-others       — destroy every session except the current one
 * GET    /api/auth/sessions            — list this user's active sessions
 * DELETE /api/auth/sessions/:id        — revoke a single other session
 * GET    /api/auth/me                  — return the authenticated user
 * POST   /api/auth/forgot-password     — issue a password-reset email
 * POST   /api/auth/reset-password      — consume a reset token and set a new password
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
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { isAuthenticated } from "../middlewares/authenticate.js";
import { validate, validateSessionIdParam } from "../middlewares/validate.js";
import {
  authLimiter,
  verificationLimiter,
  passwordResetLimiter,
} from "../middlewares/rateLimiter.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import oauthRoutes from "./oauth.routes.js";

const router = Router();

// OAuth provider routes (/google, /google/callback, /github, /github/callback
// — only mounted for fully-configured providers). Kept in their own router
// so the OAuth surface can grow without cluttering this file.
router.use(oauthRoutes);

router.post(
  "/register",
  authLimiter,
  validate(registerSchema, "body"),
  register,
);

router.post(
  "/verify-email",
  verificationLimiter,
  validate(verifyEmailSchema, "body"),
  verifyEmail,
);

router.post(
  "/resend-verification",
  verificationLimiter,
  validate(resendVerificationSchema, "body"),
  resendVerification,
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

router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(forgotPasswordSchema, "body"),
  forgotPassword,
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  validate(resetPasswordSchema, "body"),
  resetPassword,
);

export default router;
