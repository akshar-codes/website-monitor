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
 */
export const register = asyncHandler(async (req, res, next) => {
  const {
    confirmPassword: _confirmPassword,
    rememberMe,
    ...payload
  } = req.body;
  const user = await authService.registerUser(payload);

  req.login(user, (err) => {
    if (err) return next(err);

    applySessionPersistence(req, { rememberMe });

    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      return sendSuccess(res, {
        statusCode: 201,
        message: "Account created successfully",
        data: user,
      });
    });
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
