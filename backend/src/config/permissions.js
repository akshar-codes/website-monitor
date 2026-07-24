import { ROLES } from "./constants.js";

/**
 * Declarative role → permission map. Coarse-grained action permissions,
 * independent of subscription plan (see config/features.js for
 * plan-gated capabilities) and independent of per-resource ownership
 * (see middlewares/ownership.js) — the three layers compose rather than
 * overlap, so a single access decision never has to duplicate logic that
 * belongs to another layer.
 *
 * Adding a new permission is a one-line addition to the relevant role's
 * array. Adding a new role starts in config/constants.js (ROLES), then a
 * corresponding entry here — nothing else needs to change; every
 * consumer (utils/permissions.js, middlewares/permission.js,
 * middlewares/resourceAccess.js) reads from this single map.
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

/** Flat, de-duplicated list of every permission string that exists. */
export const ALL_PERMISSIONS = Object.freeze([
  ...new Set(Object.values(ROLE_PERMISSIONS).flat()),
]);
