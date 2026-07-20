import passport from "../config/passport.js";
import env from "../config/env.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import * as authService from "../services/auth.service.js";
import * as sessionService from "../services/session.service.js";
import { applySessionPersistence } from "../utils/sessionMeta.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 *
 * BREAKING CHANGE: registration no longer establishes a session. The
 * account is created in an unverified state and a verification email is
 * sent; the user must verify before they're able to log in (see `login`
 * below). This is intentional — accounts should not be usable before the
 * email address behind them has been confirmed.
 */
export const register = asyncHandler(async (req, res) => {
  const {
    confirmPassword: _confirmPassword,
    rememberMe: _rememberMe,
    ...payload
  } = req.body;

  const user = await authService.registerUser(payload);

  sendSuccess(res, {
    statusCode: 201,
    message:
      "Account created successfully. Please check your email to verify your account before signing in.",
    data: user,
  });
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return next(
        ApiError.unauthorized(info?.message || "Incorrect email or password"),
      );
    }

    // Credentials are correct but the account hasn't confirmed its email
    // yet — block session creation. The `EMAIL_NOT_VERIFIED` code lets the
    // frontend surface a "resend verification email" action instead of a
    // generic auth failure.
    if (!user.emailVerified) {
      return next(ApiError.emailNotVerified());
    }

    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);

      applySessionPersistence(req, { rememberMe: req.body.rememberMe });

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return sendSuccess(res, {
          message: "Logged in successfully",
          data: user,
        });
      });
    });
  })(req, res, next);
});

/**
 * POST /api/auth/logout
 * Ends the current device's session only.
 */
export const logout = asyncHandler(async (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(env.SESSION_NAME);
      return sendSuccess(res, { message: "Logged out successfully" });
    });
  });
});

/**
 * POST /api/auth/logout-all
 * Ends every session for this user, including the current device.
 */
export const logoutAll = asyncHandler(async (req, res, next) => {
  const userId = req.user.id || req.user._id.toString();

  await sessionService.destroyAllUserSessions(userId);

  req.logout((err) => {
    if (err) return next(err);

    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie(env.SESSION_NAME);
      return sendSuccess(res, { message: "Logged out from all devices" });
    });
  });
});

/**
 * POST /api/auth/logout-others
 * Ends every session for this user except the one making the request.
 */
export const logoutOtherSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id.toString();

  const count = await sessionService.destroyAllUserSessions(userId, {
    exceptSessionId: req.sessionID,
  });

  sendSuccess(res, {
    message:
      count > 0
        ? `Logged out from ${count} other device${count === 1 ? "" : "s"}`
        : "No other active sessions found",
    data: { count },
  });
});

/**
 * GET /api/auth/sessions
 * Lists every active session for the current user, flagging which one is
 * the caller's current device.
 */
export const listSessions = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id.toString();

  const sessions = await sessionService.listUserSessions(userId, req.sessionID);

  sendSuccess(res, { data: sessions });
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revokes a single other device's session.
 */
export const revokeSession = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id.toString();
  const { sessionId } = req.params;

  if (sessionId === req.sessionID) {
    throw ApiError.badRequest("Use /auth/logout to end your current session");
  }

  const destroyed = await sessionService.destroySessionById(sessionId, userId);

  if (!destroyed) {
    throw ApiError.notFound("Session not found");
  }

  sendSuccess(res, { message: "Session revoked successfully" });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user });
});

/**
 * POST /api/auth/verify-email
 * Confirms a user's email address using the token from the emailed link.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await authService.verifyEmail(token);

  sendSuccess(res, {
    message: "Email verified successfully. You can now sign in.",
    data: { email: user.email, emailVerified: user.emailVerified },
  });
});

/**
 * POST /api/auth/resend-verification
 * Re-sends the verification email for an unverified account. Always
 * returns a generic success response — see auth.service.js for rationale.
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.resendVerificationEmail(email);

  sendSuccess(res, {
    message:
      "If an account with that email exists and isn't verified yet, a new verification email has been sent.",
  });
});

/**
 * POST /api/auth/forgot-password
 * Issues a password-reset email for the given address. Always returns a
 * generic success response regardless of whether the account exists —
 * see auth.service.js for the anti-enumeration rationale.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  await authService.forgotPassword(email);

  sendSuccess(res, {
    message:
      "If an account with that email exists, a password reset link has been sent.",
  });
});

/**
 * POST /api/auth/reset-password
 * Consumes a password-reset token and sets a new password. Every existing
 * session for the account is invalidated as part of the reset — the user
 * must sign back in with the new password afterward.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  await authService.resetPassword(token, password);

  sendSuccess(res, {
    message:
      "Your password has been reset successfully. Please sign in with your new password.",
  });
});
