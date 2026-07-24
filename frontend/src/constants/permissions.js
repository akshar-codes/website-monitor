import { ROLES } from "./roles";

/**
 * Client-side mirror of backend/src/config/permissions.js — used only to
 * drive UI rendering (show/hide controls the user isn't allowed to use).
 * The backend remains the sole source of truth and re-checks every
 * permission on every request; keep the two maps in sync manually, the
 * same way frontend/src/constants/roles.js and plans.js already mirror
 * their backend counterparts.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.USER]: Object.freeze([
    "monitor:read",
    "monitor:create",
    "monitor:update",
    "monitor:delete",
    "incident:read",
    "incident:update",
    "plan:read",
    "plan:change",
  ]),
  [ROLES.ADMIN]: Object.freeze([
    "monitor:read",
    "monitor:create",
    "monitor:update",
    "monitor:delete",
    "incident:read",
    "incident:update",
    "plan:read",
    "plan:change",
    "user:read",
    "user:manage-role",
  ]),
});

export function roleHasPermission(role, permission) {
  return (ROLE_PERMISSIONS[role] || []).includes(permission);
}
