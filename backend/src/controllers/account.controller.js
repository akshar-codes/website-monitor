import asyncHandler from "../utils/asyncHandler.js";
import * as profileService from "../services/profile.service.js";
import env from "../config/env.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const getAccountSettings = asyncHandler(async (req, res) => {
  const data = await profileService.getProfile(req.user);
  sendSuccess(res, { data });
});

export const updateAccountSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const data = await profileService.updateProfile(userId, req.body);
  sendSuccess(res, { message: "Account settings saved", data });
});

export const deleteAccount = asyncHandler(async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  await profileService.deleteAccount(userId, req.body.confirmationEmail);

  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie(env.SESSION_NAME);
      sendSuccess(res, { message: "Account deleted successfully" });
    });
  });
});
