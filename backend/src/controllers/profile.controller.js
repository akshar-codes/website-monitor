import asyncHandler from "../utils/asyncHandler.js";
import * as profileService from "../services/profile.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

// ── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/profile
 * The caller's own full profile, including account metadata and the
 * computed profile-completion breakdown.
 */
export const getProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getProfile(req.user);

  sendSuccess(res, { data });
});

/**
 * PUT /api/profile
 * Partial update of editable profile fields (name, bio, location,
 * website, phone).
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const data = await profileService.updateProfile(userId, req.body);

  sendSuccess(res, {
    message: "Profile updated successfully",
    data,
  });
});

/**
 * POST /api/profile/avatar
 * Replaces the caller's avatar image. `req.file` is populated by the
 * handleAvatarUpload middleware (middlewares/uploadAvatar.js).
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const data = await profileService.uploadAvatar(userId, req.file);

  sendSuccess(res, {
    message: "Avatar uploaded successfully",
    data,
  });
});

/**
 * DELETE /api/profile/avatar
 * Removes the caller's current avatar image, if any.
 */
export const deleteAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.id || req.user._id;
  const data = await profileService.deleteAvatar(userId);

  sendSuccess(res, {
    message: "Avatar removed successfully",
    data,
  });
});

/**
 * GET /api/profile/public/:id
 * Public-safe profile view for any user ID — no authentication required.
 */
export const getPublicProfile = asyncHandler(async (req, res) => {
  const data = await profileService.getPublicProfile(req.params.id);

  sendSuccess(res, { data });
});
