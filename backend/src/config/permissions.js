import { ROLES } from "./constants.js";

/**
 * Declarative role → permission map. Coarse-grained action permissions,
 * independent of subscription plan (see config/features.js for
 * plan-gated capabilities) and independent of per-resource ownership
 * (see middlewares/ownership.js) — the three layers compose rather than
 * overlap, so a single access decision never has to duplicate logic that
 * belongs to another layer.
 *
 * This is the SINGLE SOURCE OF TRUTH for role→permission mappings. It is
 * consumed in three places:
 *   1. Backend middleware (middlewares/permission.js, via
 *      utils/permissions.js) — the actual enforcement point.
 *   2. models/User.js's `permissions` virtual — serialized onto every
 *      user object returned by /auth/me, /auth/login, and /auth/register,
 *      so the frontend receives its own permission list directly from
 *      the account it's authenticated as.
 *   3. The frontend's PermissionsContext reads that serialized
 *      `user.permissions` array — it no longer keeps its own copy of this
 *      map (frontend/src/constants/permissions.js was deleted), so there
 *      is exactly one place this mapping is defined, eliminating the
 *      drift risk that came from maintaining it in two codebases.
 *
 * Adding a new permission is a one-line addition to the relevant role's
 * array. Adding a new role starts in config/constants.js (ROLES), then a
 * corresponding entry here — nothing else needs to change.
 *
 * NOTE — admin accounts cannot create monitors: "monitor:create" is
 * intentionally present on ROLES.USER only. Admin accounts are
 * management-only (see routes/monitor.routes.js, which enforces this via
 * requirePermission("monitor:create"), and services/monitor.service.js,
 * which additionally guards against it directly as defense-in-depth).
 * Admins retain monitor:read/update/delete for support/moderation
 * purposes; only creation is restricted.
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
    "plan-upgrade-request:create",
    "plan-upgrade-request:read",
    "usage:read",
    "activity:read",
    "notification:read",
    "notification:update",
    "notification:delete",
  ]),

  [ROLES.ADMIN]: Object.freeze([
    "monitor:read",
    "monitor:update",
    "monitor:delete",
    "incident:read",
    "incident:update",
    "plan:read",
    "plan:change",
    "usage:read",
    "activity:read",
    "user:read",
    "user:manage-role",
    "plan-upgrade-request:manage",
    "notification:read",
    "notification:update",
    "notification:delete",
  ]),
});

/** Flat, de-duplicated list of every permission string that exists. */
export const ALL_PERMISSIONS = Object.freeze([
  ...new Set(Object.values(ROLE_PERMISSIONS).flat()),
]);
