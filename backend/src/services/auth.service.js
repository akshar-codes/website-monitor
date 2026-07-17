import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";

// ── Registration ──────────────────────────────────────────────────────────────

export const registerUser = async ({ name, email, password }) => {
  const existing = await User.findByEmail(email);
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  // Password hashing happens in the User pre-save hook.
  const user = await User.create({ name, email, password });
  return user;
};

// ── Login ────────────────────────────────────────────────────────────────────
export const validateCredentials = async (email, password) => {
  const user = await User.findByEmail(email).select("+password");
  if (!user || !user.active) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  return User.findById(user._id); // re-fetch without the password field
};

// ── Session lookup ───────────────────────────────────────────────────────────

export const getUserById = async (id) => {
  return User.findById(id);
};
