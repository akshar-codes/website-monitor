import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";

/**
 * Generic ownership-guard factory. Loads a document by
 * `req.params[idParam]` and verifies the field at `ownerField` matches the
 * requesting user's ID, unless the user's role is listed in `bypassRoles`
 * (admins, by default). The loaded document is attached to
 * `req[attachAs]` so the downstream handler doesn't have to re-fetch it.
 *
 * Not currently wired to any route: every user-scoped resource in this
 * codebase (Monitor, Incident, HealthCheck, DailyStat) is already scoped
 * to `owner` directly inside its service layer (see
 * services/monitor.service.js#getOwnedMonitorIds and its callers), so
 * there is no route today that needs a *generic* ownership check on top
 * of that. This factory is kept ready for the next user-owned resource
 * that doesn't want to duplicate that per-service scoping pattern:
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
            "OWNERSHIP_REQUIRED",
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
