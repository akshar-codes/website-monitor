import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";

// ── Service methods ───────────────────────────────────────────────────────────

export const getUsers = async ({ page, limit, role }) => {
  const filter = {};
  if (role) filter.role = role;

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    users,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

/**
 * Updates a target user's role. Two invariants are enforced here rather
 * than left to the caller, since both are safety-critical and easy to
 * forget:
 *   1. An admin can never change their OWN role through this endpoint —
 *      prevents an accidental (or coerced) self-lockout.
 *   2. The last remaining admin can never be demoted — prevents the
 *      application from ending up with zero admins and no way to promote
 *      a new one without direct database access.
 */
export const updateUserRole = async (targetUserId, role, actingUser) => {
  const actingUserId = actingUser.id || actingUser._id.toString();

  if (targetUserId === actingUserId) {
    throw ApiError.badRequest("You cannot change your own role");
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw ApiError.notFound(`User not found with id: ${targetUserId}`);
  }

  if (user.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
    const adminCount = await User.countDocuments({ role: ROLES.ADMIN });
    if (adminCount <= 1) {
      throw ApiError.badRequest(
        "Cannot remove the last remaining admin. Promote another user to admin first.",
      );
    }
  }

  user.role = role;
  // Role is not part of the password/validation chain — skip full
  // document revalidation the same way other metadata-only updates do
  // (e.g. recordLogin) to avoid re-checking unrelated fields.
  await user.save({ validateBeforeSave: false });

  return user;
};
