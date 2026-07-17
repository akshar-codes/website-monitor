import passport from "../config/passport.js";
import env from "../config/env.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import * as authService from "../services/auth.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res, next) => {
  const { confirmPassword: _confirmPassword, ...payload } = req.body;
  const user = await authService.registerUser(payload);

  req.login(user, (err) => {
    if (err) return next(err);
    return sendSuccess(res, {
      statusCode: 201,
      message: "Account created successfully",
      data: user,
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
      return sendSuccess(res, {
        message: "Logged in successfully",
        data: user,
      });
    });
  })(req, res, next);
});

/**
 * POST /api/auth/logout
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
 * GET /api/auth/me
 * Returns the currently authenticated user.
 */
export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user });
});
