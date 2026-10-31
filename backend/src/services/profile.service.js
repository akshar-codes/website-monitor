import fs from "fs/promises";
import path from "path";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import {
  AVATAR_DIR_ABSOLUTE,
  AVATAR_URL_PREFIX,
} from "../middlewares/uploadAvatar.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import DailyStat from "../models/DailyStat.js";
import HourlyStat from "../models/HourlyStat.js";
import PerformanceAlertState from "../models/PerformanceAlertState.js";
import RegionalCheck from "../models/RegionalCheck.js";
import RegionalProbeRun from "../models/RegionalProbeRun.js";
import RegionalIncident from "../models/RegionalIncident.js";
import RegionalDailyStat from "../models/RegionalDailyStat.js";
import RegionalHourlyStat from "../models/RegionalHourlyStat.js";
import RegionalPerformanceState from "../models/RegionalPerformanceState.js";
import Incident from "../models/Incident.js";
import SslInfo from "../models/SslInfo.js";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import UserPreference from "../models/UserPreference.js";
import ApiKey from "../models/ApiKey.js";
import PlanUpgradeRequest from "../models/PlanUpgradeRequest.js";
import { destroyAllUserSessions } from "./session.service.js";
import { deleteStatusPagesForOwner } from "./statusPageCleanup.service.js";

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

export const deleteAccount = async (userId, confirmationEmail) => {
  const account = await User.findById(userId);
  if (!account) throw ApiError.notFound("User not found");
  if (account.email.toLowerCase() !== confirmationEmail.toLowerCase()) {
    throw ApiError.badRequest("The email address does not match this account");
  }

  const monitorDocs = await Monitor.find({ owner: account._id })
    .select("_id")
    .lean();
  const monitorIds = monitorDocs.map(({ _id }) => _id);

  await deleteStatusPagesForOwner(account._id);

  await Promise.all([
    HealthCheck.deleteMany({ monitor: { $in: monitorIds } }),
    DailyStat.deleteMany({ monitor: { $in: monitorIds } }),
    HourlyStat.deleteMany({ monitor: { $in: monitorIds } }),
    PerformanceAlertState.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalCheck.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalProbeRun.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalIncident.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalDailyStat.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalHourlyStat.deleteMany({ monitor: { $in: monitorIds } }),
    RegionalPerformanceState.deleteMany({ monitor: { $in: monitorIds } }),
    Incident.deleteMany({ monitor: { $in: monitorIds } }),
    SslInfo.deleteMany({ monitor: { $in: monitorIds } }),
    Monitor.deleteMany({ owner: account._id }),
    Activity.deleteMany({ user: account._id }),
    Notification.deleteMany({ owner: account._id }),
    UserPreference.deleteMany({ user: account._id }),
    ApiKey.deleteMany({ owner: account._id }),
    PlanUpgradeRequest.deleteMany({ user: account._id }),
  ]);

  await account.deleteOne();
  await destroyAllUserSessions(account._id.toString());
  await deleteLocalAvatarFile(account.avatarUrl);
  logger.info(`Account ${account._id} permanently deleted by its owner`);
};

// ── Update profile ───────────────────────────────────────────────────────────

export const updateProfile = async (userId, data) => {
  // Use a field-level update instead of document.save(). The password and
  // OAuth identities are intentionally excluded from this query by default;
  // document.save() would run the account password invariant against those
  // unselected fields and reject an otherwise valid profile edit.
  const user = await User.findByIdAndUpdate(userId, data, {
    new: true,
    runValidators: true,
  });
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  logger.info(`Profile updated for user ${user._id}`);

  await logActivity({
    userId: user._id,
    category: ACTIVITY_CATEGORIES.PROFILE,
    action: ACTIVITY_ACTIONS.PROFILE_UPDATED,
    description: "Updated profile information",
    entityType: "User",
    entityId: user._id,
    metadata: { changedFields: Object.keys(data) },
  });

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

  await logActivity({
    userId: user._id,
    category: ACTIVITY_CATEGORIES.PROFILE,
    action: ACTIVITY_ACTIONS.AVATAR_UPLOADED,
    description: "Updated profile photo",
    entityType: "User",
    entityId: user._id,
  });

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

  await logActivity({
    userId: user._id,
    category: ACTIVITY_CATEGORIES.PROFILE,
    action: ACTIVITY_ACTIONS.AVATAR_REMOVED,
    description: "Removed profile photo",
    entityType: "User",
    entityId: user._id,
  });

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
