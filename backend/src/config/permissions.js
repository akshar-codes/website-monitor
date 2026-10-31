import { ROLES } from "./constants.js";

/**
 * Declarative role → permission map. Coarse-grained action permissions,
 * independent of subscription plan (see config/features.js for
 * plan-gated capabilities) and independent of per-resource ownership
 * (see middlewares/ownership.js) — the three layers compose rather than
 * overlap, so a single access decision never has to duplicate logic that
 * belongs to another layer.
 */
export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.USER]: Object.freeze([
    "monitor:read",
    "monitor:create",
    "monitor:update",
    "monitor:delete",
    "status-page:read",
    "status-page:create",
    "status-page:update",
    "status-page:delete",
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
    "status-page:read",
    "status-page:update",
    "status-page:delete",
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
