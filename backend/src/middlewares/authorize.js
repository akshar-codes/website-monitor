import ApiError from "../utils/ApiError.js";

/**
 * Restricts a route to users whose `role` is one of `allowedRoles`.
 *
 * Must run AFTER `isAuthenticated` — it relies on `req.user` already being
 * populated by Passport's session deserialization, and deliberately does
 * not duplicate the "are you logged in at all" check (that's
 * `isAuthenticated`'s job; keeping the two concerns in separate middleware
 * lets a route compose them explicitly and keeps each one testable in
 * isolation).
 *
 * Usage:
 *   router.use("/admin", isAuthenticated, authorize(ROLES.ADMIN), adminRoutes);
 *   router.delete("/:id", isAuthenticated, authorize(ROLES.ADMIN, ROLES.USER), ...);
 */
export const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized("Please log in to continue"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          "You do not have permission to perform this action",
        ),
      );
    }

    return next();
  };

export default authorize;
