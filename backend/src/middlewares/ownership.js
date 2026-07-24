import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";

/**
 * Generic ownership-guard factory. Loads a document by
 * `req.params[idParam]` and verifies the field at `ownerField` matches the
 * requesting user's ID, unless the user's role is listed in `bypassRoles`
 * (admins, by default). The loaded document is attached to
 * `req[attachAs]` so the downstream handler doesn't have to re-fetch it.
 *
 * Not currently wired to any route: every resource in this codebase today
 * (Monitor, Incident, HealthCheck, DailyStat) is org-wide/shared rather
 * than owned by an individual user — see utils/planUtils.js's note on
 * per-user monitor limits for the related discussion. This factory is
 * ready for the first user-owned resource without any changes to the
 * pattern itself; just add an `owner` ref to that resource's schema and
 * apply `requireOwnership(Model)` to its routes:
 *
 *   router.get(
 *     "/:id",
 *     requireOwnership(SomeUserOwnedModel, { ownerField: "owner" }),
 *     getSomeUserOwnedResource,
 *   );
 */
export const requireOwnership =
  (
    Model,
    {
      idParam = "id",
      ownerField = "owner",
      attachAs = "resource",
      bypassRoles = [ROLES.ADMIN],
    } = {},
  ) =>
  async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized("Please log in to continue"));
      }

      const id = req.params[idParam];
      const doc = await Model.findById(id);

      if (!doc) {
        return next(ApiError.notFound(`Resource not found with id: ${id}`));
      }

      const userId = req.user.id || req.user._id?.toString();
      const rawOwnerId = doc[ownerField];
      const ownerId = rawOwnerId?.toString?.() ?? rawOwnerId;

      const isBypassed = bypassRoles.includes(req.user.role);
      const isOwner = !!ownerId && ownerId === userId;

      if (!isBypassed && !isOwner) {
        return next(
          ApiError.forbidden(
            "You do not have permission to access this resource",
          ),
        );
      }

      req[attachAs] = doc;
      return next();
    } catch (error) {
      return next(error);
    }
  };

/**
 * Inline (non-middleware) ownership check for call sites that already
 * hold both the document and the acting user — e.g. inside a service
 * function — so the same comparison logic isn't re-derived ad hoc at each
 * call site.
 */
export const isOwnedBy = (doc, ownerField, user) => {
  if (!doc || !user) return false;
  const rawOwnerId = doc[ownerField];
  const ownerId = rawOwnerId?.toString?.() ?? rawOwnerId;
  const userId = user.id || user._id?.toString();
  return !!ownerId && ownerId === userId;
};
