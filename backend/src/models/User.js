import mongoose from "mongoose";
import { hashPassword, comparePassword } from "../utils/password.js";
import { OAUTH_PROVIDER_VALUES } from "../config/constants.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sub-schema for a single linked OAuth identity. Deliberately generic
// (provider + providerId) rather than one field per provider (googleId,
// githubId, ...) so adding a new provider never requires a schema change —
// see config/oauth/providers.config.js for how a new provider is wired in.
const oauthAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: {
        values: OAUTH_PROVIDER_VALUES,
        message: `Provider must be one of: ${OAUTH_PROVIDER_VALUES.join(", ")}`,
      },
    },
    providerId: {
      type: String,
      required: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [120, "Name cannot exceed 120 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [EMAIL_REGEX, "Enter a valid email address"],
    },

    // Not required at the schema level — enforced conditionally by the
    // pre-validate hook below, since an OAuth-only account never sets one.
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never returned by default queries
    },

    active: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    // Profile picture synced from whichever OAuth provider supplied one
    // (see services/oauth.service.js). Left null for password-only accounts.
    avatarUrl: {
      type: String,
      default: null,
    },

    // ── OAuth ──
    // Hidden from default queries (like password) since provider IDs are
    // internal identity-linking data, not something the client needs back.
    oauthAccounts: {
      type: [oauthAccountSchema],
      default: [],
      select: false,
    },

    // ── Email verification ──
    // A freshly registered account starts unverified; login is blocked
    // (see auth.controller.js) until the user completes the emailed link.
    // OAuth accounts are marked verified immediately when the provider
    // itself confirms the email (see services/oauth.service.js).

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    // Only the SHA-256 hash of the verification token is ever persisted —

    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },

    // Powers the resend-verification cooldown so the endpoint can't be
    // used to spam a mailbox.
    emailVerificationLastSentAt: {
      type: Date,
      default: null,
      select: false,
    },

    // ── Password reset ──

    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.oauthAccounts;
        return ret;
      },
    },

    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  },
);

// ── Indexes ──

// Fast lookup during email verification (findByValidVerificationToken).
userSchema.index({ emailVerificationTokenHash: 1 });

// Fast lookup during password reset (findByValidPasswordResetToken).
userSchema.index({ passwordResetTokenHash: 1 });

// Fast lookup + global uniqueness for a given provider account. Mongo's
// multikey index enforces this uniqueness across the whole collection (a
// given Google/GitHub providerId can only ever appear on one user), which
// is exactly the duplicate-account guard we need.
userSchema.index(
  { "oauthAccounts.provider": 1, "oauthAccounts.providerId": 1 },
  { unique: true, sparse: true },
);

// ── Middleware ──
userSchema.pre("save", async function hashPasswordHook() {
  if (!this.isModified("password")) return;
  this.password = await hashPassword(this.password);
});

// A password is required UNLESS the account has at least one linked OAuth
// identity. This keeps the local-auth invariant (password always present)
// while allowing OAuth-only accounts to never set one.
userSchema.pre("validate", function enforcePasswordUnlessOAuth(next) {
  const hasOAuthAccount =
    Array.isArray(this.oauthAccounts) && this.oauthAccounts.length > 0;

  if (!this.password && !hasOAuthAccount) {
    this.invalidate("password", "Password is required");
  }

  next();
});

// ── Instance methods ──
userSchema.methods.comparePassword = function (candidatePassword) {
  return comparePassword(candidatePassword, this.password);
};

/**
 * Assigns a new (hashed) verification token and its expiry to this
 * document. Does not save — callers persist alongside any other changes.
 */
userSchema.methods.setEmailVerificationToken = function (tokenHash, expiresAt) {
  this.emailVerificationTokenHash = tokenHash;
  this.emailVerificationExpires = expiresAt;
};

/**
 * Flips the account to verified and clears the now-consumed token fields.
 */
userSchema.methods.markEmailVerified = function () {
  this.emailVerified = true;
  this.emailVerifiedAt = new Date();
  this.emailVerificationTokenHash = null;
  this.emailVerificationExpires = null;
};

/**
 * Assigns a new (hashed) password-reset token and its expiry to this
 * document. Does not save — callers persist alongside any other changes.
 */
userSchema.methods.setPasswordResetToken = function (tokenHash, expiresAt) {
  this.passwordResetTokenHash = tokenHash;
  this.passwordResetExpires = expiresAt;
};

/**
 * Clears the (now-consumed, or superseded) password-reset token fields.
 */
userSchema.methods.clearPasswordResetToken = function () {
  this.passwordResetTokenHash = null;
  this.passwordResetExpires = null;
};

/**
 * Links a new OAuth identity to this user, unless that provider is already
 * linked (idempotent — re-authenticating with the same provider is a no-op
 * here since the providerId itself never changes for an existing link).
 * Does not save — callers persist alongside any other changes.
 */
userSchema.methods.linkOAuthAccount = function (provider, providerId) {
  if (!Array.isArray(this.oauthAccounts)) {
    this.oauthAccounts = [];
  }

  const alreadyLinked = this.oauthAccounts.some(
    (account) => account.provider === provider,
  );

  if (!alreadyLinked) {
    this.oauthAccounts.push({ provider, providerId, connectedAt: new Date() });
  }
};

// ── Statics ──

userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

/**
 * Same lookup as `findByEmail` but also returns the (normally hidden)
 * verification bookkeeping fields — used by the resend-verification flow.
 */
userSchema.statics.findByEmailWithVerification = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() }).select(
    "+emailVerificationTokenHash +emailVerificationExpires +emailVerificationLastSentAt",
  );
};

/**
 * Finds the user owning a given (hashed) verification token
 */
userSchema.statics.findByValidVerificationToken = function (tokenHash) {
  return this.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationTokenHash +emailVerificationExpires");
};

/**
 * Finds the user owning a given (hashed) password-reset token, provided
 */
userSchema.statics.findByValidPasswordResetToken = function (tokenHash) {
  return this.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");
};

/**
 * Finds the user who has the given (provider, providerId) pair linked.
 * `oauthAccounts` is select:false by default, so it's explicitly re-added.
 */
userSchema.statics.findByOAuthAccount = function (provider, providerId) {
  return this.findOne({
    oauthAccounts: { $elemMatch: { provider, providerId } },
  }).select("+oauthAccounts");
};

const User = mongoose.model("User", userSchema);

export default User;
