import fs from "fs/promises";
import path from "path";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { AVATAR_DIR_ABSOLUTE, AVATAR_URL_PREFIX } from "../middlewares/uploadAvatar.js";

// ── Profile completion ──────────────────────────────────────────────────────

/** Optional fields that count toward the profile-completion percentage. */
const COMPLETION_FIELDS = [
  "name",
  "avatarUrl",
  "bio",
  "location",
  "website",
  "phone",
];

/**
 * Computes a 0–100 completion percentage plus the list of fields still
 * missing, so the frontend's completion indicator (and any future
 * "complete your profile" nudge) can render without duplicating this
 * logic. Email verification counts as one additional completion signal,
 * since an unverified account is functionally incomplete.
 */
export const computeProfileCompletion = (user) => {
  const filledFields = COMPLETION_FIELDS.filter((field) => {
    const value = user[field];
    return typeof value === "string" ? value.trim().length > 0 : !!value;
  });

  const totalSignals = COMPLETION_FIELDS.length + 1; // +1 for emailVerified
  const filledSignals = filledFields.length + (user.emailVerified ? 1 : 0);

  return {
    percentage: Math.round((filledSignals / totalSignals) * 100),
    missingFields: COMPLETION_FIELDS.filter(
      (field) => !filledFields.includes(field),
    ),
  };
};

// ── Avatar file management ──────────────────────────────────────────────────

/** True when `avatarUrl` points at a file this service manages locally,
 * as opposed to an external URL supplied by an OAuth provider. */
const isLocallyManagedAvatar = (avatarUrl) =>
  !!avatarUrl && avatarUrl.startsWith(AVATAR_URL_PREFIX);

/**
 * Best-effort deletion of a locally-stored avatar file. Never throws —
 * a failure to clean up an old file must not fail the request that's
 * replacing or removing it; the residual file is harmless disk usage,
 * not a correctness issue.
 */
const deleteLocalAvatarFile = async (avatarUrl) => {
  if (!isLocallyManagedAvatar(avatarUrl)) return;

  const filename = path.basename(avatarUrl);
  const filePath = path.join(AVATAR_DIR_ABSOLUTE, filename);

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.error(
        `Failed to delete avatar file "${filePath}": ${error.message}`,
        { stack: error.stack },
      );
    }
  }
};

// ── View profile ─────────────────────────────────────────────────────────────

export const getProfile = async (user) => {
  const fresh = await User.findById(user.id || user._id);
  if (!fresh) {
    throw ApiError.notFound("User not found");
  }

  return {
    ...fresh.toJSON(),
    profileCompletion: computeProfileCompletion(fresh),
  };
};

// ── Update profile ───────────────────────────────────────────────────────────

export const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  Object.assign(user, data);
  await user.save();

  logger.info(`Profile updated for user ${user._id}`);

  return {
    ...user.toJSON(),
    profileCompletion: computeProfileCompletion(user),
  };
};

// ── Avatar ────────────────────────────────────────────────────────────────────

export const uploadAvatar = async (userId, file) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  const previousAvatarUrl = user.avatarUrl;

  user.avatarUrl = `${AVATAR_URL_PREFIX}/${file.filename}`;
  await user.save({ validateBeforeSave: false });

  // Clean up the old file only after the new one is committed, so a
  // mid-request failure never leaves the account without any avatar file.
  await deleteLocalAvatarFile(previousAvatarUrl);

  logger.info(`Avatar updated for user ${user._id}`);

  return {
    ...user.toJSON(),
    profileCompletion: computeProfileCompletion(user),
  };
};

export const deleteAvatar = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (!user.avatarUrl) {
    throw ApiError.badRequest("No avatar image to remove");
  }

  const previousAvatarUrl = user.avatarUrl;
  user.avatarUrl = null;
  await user.save({ validateBeforeSave: false });

  await deleteLocalAvatarFile(previousAvatarUrl);

  logger.info(`Avatar removed for user ${user._id}`);

  return {
    ...user.toJSON(),
    profileCompletion: computeProfileCompletion(user),
  };
};

// ── Public profile ───────────────────────────────────────────────────────────

/**
 * Public-safe view of a user, exposing only fields intended for other
 * people to see — never email, role, plan, login activity, or any other
 * account-internal data.
 */
export const getPublicProfile = async (userId) => {
  const user = await User.findById(userId).select(
    "name avatarUrl bio location website active createdAt",
  );

  if (!user || user.active === false) {
    throw ApiError.notFound("User not found");
  }

  return {
    id: user._id,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio || null,
    location: user.location || null,
    website: user.website || null,
    memberSince: user.createdAt,
  };
};
