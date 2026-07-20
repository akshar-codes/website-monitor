import mongoose from "mongoose";
import { hashPassword, comparePassword } from "../utils/password.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    password: {
      type: String,
      required: [true, "Password is required"],
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

    // ── Email verification ──
    // A freshly registered account starts unverified; login is blocked
    // (see auth.controller.js) until the user completes the emailed link.

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

// ── Middleware ──
userSchema.pre("save", async function hashPasswordHook() {
  if (!this.isModified("password")) return;
  this.password = await hashPassword(this.password);
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

const User = mongoose.model("User", userSchema);

export default User;
