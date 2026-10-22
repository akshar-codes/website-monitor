import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import ApiKey from "../models/ApiKey.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { PLANS, ROLES } from "../config/constants.js";

const KEY_LIMITS = { [PLANS.PRO]: 5, [PLANS.UNLIMITED]: 20 };
const hashSecret = (secret) =>
  createHash("sha256").update(secret).digest("hex");

const assertEligible = (user) => {
  if (user.role === ROLES.ADMIN)
    throw ApiError.forbidden(
      "API keys are unavailable for administrative accounts.",
      "ROLE_FORBIDDEN",
    );
  if (!KEY_LIMITS[user.plan])
    throw ApiError.upgradeRequired(
      "API keys are available on the Pro plan and above.",
      PLANS.PRO,
    );
};

export const listApiKeys = async (user) =>
  ApiKey.find({ owner: user.id || user._id })
    .select("name prefix createdAt lastUsedAt expiresAt revokedAt")
    .sort({ createdAt: -1 })
    .lean();

export const createApiKey = async (user, { name, expiresInDays }) => {
  assertEligible(user);
  const owner = user.id || user._id;
  const activeCount = await ApiKey.countDocuments({
    owner,
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
  if (activeCount >= KEY_LIMITS[user.plan]) {
    if (user.plan === PLANS.PRO) {
      throw ApiError.upgradeRequired(
        `Your Pro plan allows up to ${KEY_LIMITS[user.plan]} active API keys. Upgrade to Unlimited for more.`,
        PLANS.UNLIMITED,
      );
    }
    throw ApiError.badRequest(
      `Your plan allows up to ${KEY_LIMITS[user.plan]} active API keys. Revoke an existing key before creating another.`,
    );
  }
  const identifier = randomBytes(6).toString("hex");
  const prefix = `wm_live_${identifier}`;
  const secret = `${prefix}_${randomBytes(32).toString("base64url")}`;
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000)
    : null;
  const apiKey = await ApiKey.create({
    owner,
    name,
    prefix,
    keyHash: hashSecret(secret),
    expiresAt,
  });
  return { apiKey: apiKey.toJSON(), secret };
};

export const revokeApiKey = async (user, id) => {
  const owner = user.id || user._id;
  const key = await ApiKey.findOneAndUpdate(
    { _id: id, owner, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { returnDocument: "after" },
  ).select("-keyHash");
  if (!key) throw ApiError.notFound("Active API key not found");
  return key;
};

export const deleteApiKey = async (user, id) => {
  const result = await ApiKey.deleteOne({
    _id: id,
    owner: user.id || user._id,
  });
  if (!result.deletedCount) throw ApiError.notFound("API key not found");
};

export const authenticateApiKeySecret = async (secret) => {
  const match = /^wm_live_([a-f0-9]{12})_([A-Za-z0-9_-]{43})$/.exec(
    secret || "",
  );
  if (!match) return null;
  const prefix = `wm_live_${match[1]}`;
  const key = await ApiKey.findOne({
    prefix,
    revokedAt: null,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).select("+keyHash");
  if (!key) return null;
  const candidate = Buffer.from(hashSecret(secret), "hex");
  const stored = Buffer.from(key.keyHash, "hex");
  if (candidate.length !== stored.length || !timingSafeEqual(candidate, stored))
    return null;
  const user = await User.findOne({ _id: key.owner, active: true }).select(
    "role plan active",
  );
  if (!user || user.role === ROLES.ADMIN || !KEY_LIMITS[user.plan]) return null;
  return { key, user };
};

export const recordApiKeyUse = (keyId) =>
  ApiKey.updateOne(
    { _id: keyId, revokedAt: null },
    { $set: { lastUsedAt: new Date() } },
  );
