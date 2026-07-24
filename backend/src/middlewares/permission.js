import ApiError from "../utils/ApiError.js";
import {
  userHasAllPermissions,
  userHasAnyPermission,
} from "../utils/permissions.js";

/**
 * Requires the authenticated user's role to grant EVERY permission
 * listed. Must run after `isAuthenticated` — relies on `req.user` already
 * being populated by Passport's session deserialization, mirroring the
 * ordering requirement documented on middlewares/authorize.js.
 */
export const requirePermission =
  (...permissions) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Please log in to continue"));
    }

    if (!userHasAllPermissions(req.user, permissions)) {
      return next(
        ApiError.forbidden("You do not have permission to perform this action"),
      );
    }

    return next();
  };

/**
 * Requires the authenticated user's role to grant AT LEAST ONE of the
 * permissions listed.
 */
export const requireAnyPermission =
  (...permissions) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Please log in to continue"));
    }

    if (!userHasAnyPermission(req.user, permissions)) {
      return next(
        ApiError.forbidden("You do not have permission to perform this action"),
      );
    }

    return next();
  };
