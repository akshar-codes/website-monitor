import { ROLE_PERMISSIONS } from "../config/permissions.js";

/**
 * Reusable, framework-agnostic permission-checking logic. Kept separate
 * from middlewares/permission.js (the Express-specific wrapper) so the
 * same checks can be reused from services, controllers, or tests without
 * needing a `(req, res, next)` signature.
 */

export const getPermissionsForRole = (role) => ROLE_PERMISSIONS[role] || [];

export const roleHasPermission = (role, permission) =>
  getPermissionsForRole(role).includes(permission);

export const userHasPermission = (user, permission) =>
  !!user && roleHasPermission(user.role, permission);

/** True when the user holds AT LEAST ONE of the given permissions. */
export const userHasAnyPermission = (user, permissions = []) =>
  permissions.some((permission) => userHasPermission(user, permission));

/** True when the user holds EVERY one of the given permissions. */
export const userHasAllPermissions = (user, permissions = []) =>
  permissions.every((permission) => userHasPermission(user, permission));
