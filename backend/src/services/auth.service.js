import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { generateSecureToken, hashToken } from "../utils/tokenUtils.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from "./email.service.js";
import { destroyAllUserSessions } from "./session.service.js";
import logger from "../utils/logger.js";

// ── Registration ──────────────────────────────────────────────────────────────

export const registerUser = async ({ name, email, password }) => {
  const existing = await User.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  // Password hashing happens in the User pre-save hook.
  const user = await User.create({ name, email, password });

  await issueEmailVerificationToken(user);

  return user;
};

// ── Login ────────────────────────────────────────────────────────────────────

/**
 * Validates local (email/password) credentials and records login activity
 * on success. `meta.ip` is optional — passed through from the Local
 * strategy's `passReqToCallback` so every successful local sign-in is
 * attributable to a client IP, mirroring what the OAuth callback flow
 * records (see controllers/oauth.controller.js).
 */
export const validateCredentials = async (email, password, meta = {}) => {
  const user = await User.findByEmail(email).select("+password");
  if (!user || !user.active) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  user.recordLogin(meta.ip);
  await user.save({ validateBeforeSave: false });

  logger.info(
    `Local login succeeded for user ${user._id} (${user.email})${meta.ip ? ` from ${meta.ip}` : ""}`,
  );

  return User.findById(user._id); // re-fetch without the password field
};

// ── Session lookup ───────────────────────────────────────────────────────────

export const getUserById = async (id) => {
  return User.findById(id);
};

// ── Email verification ───────────────────────────────────────────────────────

/**
 * Generates a fresh verification token for a user, persists its hash, and
 * dispatches the verification email. Shared by registration, the resend
 * endpoint, and OAuth sign-ups whose provider couldn't confirm an email
 * address, so token issuance always follows one code path.
 */
export const issueEmailVerificationToken = async (user) => {
  const { token, tokenHash } = generateSecureToken();
  const expiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TOKEN_EXPIRES_MS,
  );

  user.setEmailVerificationToken(tokenHash, expiresAt);
  user.emailVerificationLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  await sendVerificationEmail(user, token);

  return user;
};

/**
 * Verifies a submitted raw token: hashes it, looks up a matching
 * non-expired user document, and flips the account to verified.
 * Throws on an invalid/expired token — the message deliberately doesn't
 * distinguish "never existed" from "expired" to avoid leaking details.
 */
export const verifyEmail = async (rawToken) => {
  const tokenHash = hashToken(rawToken);

  const user = await User.findByValidVerificationToken(tokenHash);
  if (!user) {
    throw ApiError.badRequest(
      "This verification link is invalid or has expired. Please request a new one.",
    );
  }

  if (user.emailVerified) {
    // Token was valid but the account was already verified (e.g. a stale
    // browser tab reusing an old link) — treat as success, not an error.
    return user;
  }

  user.markEmailVerified();
  await user.save({ validateBeforeSave: false });

  logger.info(`Email verified for user ${user._id} (${user.email})`);

  return user;
};

/**
 * Resends the verification email for an unverified account. Always
 * resolves without throwing — the controller returns one generic response
 * regardless of whether the account exists, is already verified, or is
 * under cooldown, so the endpoint can't be used to enumerate accounts.
 */
export const resendVerificationEmail = async (email) => {
  const user = await User.findByEmailWithVerification(email);

  if (!user || user.emailVerified) {
    return { sent: false };
  }

  const cooldownMs = env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS;
  const lastSent = user.emailVerificationLastSentAt;
  if (lastSent && Date.now() - lastSent.getTime() < cooldownMs) {
    logger.debug(`Resend verification skipped for ${email} — cooldown active`);
    return { sent: false };
  }

  await issueEmailVerificationToken(user);

  return { sent: true };
};

// ── Password reset ───────────────────────────────────────────────────────────

/**
 * Issues a password-reset token for the account matching `email`
 */
export const forgotPassword = async (email) => {
  const user = await User.findByEmail(email);

  if (!user || !user.active) {
    return { sent: false };
  }

  const { token, tokenHash } = generateSecureToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRES_MS);

  user.setPasswordResetToken(tokenHash, expiresAt);
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail(user, token);

  logger.info(`Password reset requested for user ${user._id} (${user.email})`);

  return { sent: true };
};

/**
 * Verifies a submitted raw reset token, sets the new password
 */
export const resetPassword = async (rawToken, newPassword) => {
  const tokenHash = hashToken(rawToken);

  const user = await User.findByValidPasswordResetToken(tokenHash);
  if (!user) {
    throw ApiError.badRequest(
      "This password reset link is invalid or has expired. Please request a new one.",
    );
  }

  user.password = newPassword; // re-hashed by the pre-save hook
  user.clearPasswordResetToken();
  await user.save();

  const destroyedCount = await destroyAllUserSessions(user._id.toString());

  logger.info(
    `Password reset for user ${user._id} (${user.email}) — ${destroyedCount} session(s) invalidated`,
  );

  // Best-effort notification — a delivery failure here must not fail the
  // password reset itself, which has already succeeded and persisted.
  try {
    await sendPasswordChangedEmail(user);
  } catch (error) {
    logger.error(
      `Failed to send password-changed notification to ${user.email}: ${error.message}`,
      { stack: error.stack },
    );
  }

  return user;
};
