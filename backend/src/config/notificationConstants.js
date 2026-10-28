// ── Categories ───────────────────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = Object.freeze({
  MONITOR: "monitor",
  INCIDENT: "incident",
  BILLING: "billing",
  ACCOUNT: "account",
  SYSTEM: "system",
});

export const NOTIFICATION_CATEGORY_VALUES = Object.freeze(
  Object.values(NOTIFICATION_CATEGORIES),
);

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Every concrete notification a service in this codebase can raise. Adding
 * a new notification is a two-step process:
 *   1. Add its key here
 *   2. Add its category mapping to NOTIFICATION_TYPE_CATEGORY below
 * Nothing else needs to change — the model derives `category` from `type`,
 * and the frontend's category filter/icon mapping is driven entirely by
 * `category`, not by individual type values.
 */
export const NOTIFICATION_TYPES = Object.freeze({
  MONITOR_DOWN: "monitor_down",
  MONITOR_UP: "monitor_up",
  MONITOR_DEGRADED: "monitor_degraded",
  INCIDENT_OPENED: "incident_opened",
  INCIDENT_RESOLVED: "incident_resolved",
  PLAN_UPGRADED: "plan_upgraded",
  PLAN_DOWNGRADED: "plan_downgraded",
  PLAN_UPGRADE_REQUEST_SUBMITTED: "plan_upgrade_request_submitted",
  PLAN_UPGRADE_REQUEST_APPROVED: "plan_upgrade_request_approved",
  PLAN_UPGRADE_REQUEST_REJECTED: "plan_upgrade_request_rejected",
  USAGE_LIMIT_REACHED: "usage_limit_reached",
  ACCOUNT_SECURITY: "account_security",
  SYSTEM_ANNOUNCEMENT: "system_announcement",
});

export const NOTIFICATION_TYPE_VALUES = Object.freeze(
  Object.values(NOTIFICATION_TYPES),
);

/**
 * Maps each notification type to its category — the single source of
 * truth consumed by models/Notification.js at creation time. Callers of
 * services/notification.service.js#createNotification only ever pass
 * `type`; the category is always derived, never independently supplied,
 * so the two can never drift out of sync with each other.
 */
export const NOTIFICATION_TYPE_CATEGORY = Object.freeze({
  [NOTIFICATION_TYPES.MONITOR_DOWN]: NOTIFICATION_CATEGORIES.MONITOR,
  [NOTIFICATION_TYPES.MONITOR_UP]: NOTIFICATION_CATEGORIES.MONITOR,
  [NOTIFICATION_TYPES.MONITOR_DEGRADED]: NOTIFICATION_CATEGORIES.MONITOR,
  [NOTIFICATION_TYPES.INCIDENT_OPENED]: NOTIFICATION_CATEGORIES.INCIDENT,
  [NOTIFICATION_TYPES.INCIDENT_RESOLVED]: NOTIFICATION_CATEGORIES.INCIDENT,
  [NOTIFICATION_TYPES.PLAN_UPGRADED]: NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.PLAN_DOWNGRADED]: NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_SUBMITTED]:
    NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_APPROVED]:
    NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.PLAN_UPGRADE_REQUEST_REJECTED]:
    NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.USAGE_LIMIT_REACHED]: NOTIFICATION_CATEGORIES.BILLING,
  [NOTIFICATION_TYPES.ACCOUNT_SECURITY]: NOTIFICATION_CATEGORIES.ACCOUNT,
  [NOTIFICATION_TYPES.SYSTEM_ANNOUNCEMENT]: NOTIFICATION_CATEGORIES.SYSTEM,
});

// ── Priority ─────────────────────────────────────────────────────────────────

export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical",
});

export const NOTIFICATION_PRIORITY_VALUES = Object.freeze(
  Object.values(NOTIFICATION_PRIORITIES),
);

// ── Delivery channels ────────────────────────────────────────────────────────

/**
 * Channels a notification can (eventually) be delivered through. Only
 * "inApp" is actually dispatched today — see
 * services/notification.service.js#dispatchChannels — but every
 * notification document models all three from day one (see
 * models/Notification.js) so wiring up email/push later is additive, not
 * a breaking schema/API change.
 */
export const NOTIFICATION_CHANNELS = Object.freeze({
  IN_APP: "inApp",
  EMAIL: "email",
  PUSH: "push",
});

export const NOTIFICATION_CHANNEL_VALUES = Object.freeze(
  Object.values(NOTIFICATION_CHANNELS),
);

// ── List/query filters ───────────────────────────────────────────────────────

export const NOTIFICATION_STATUS_FILTER_ALL = "all";
export const NOTIFICATION_STATUS_FILTER_UNREAD = "unread";
export const NOTIFICATION_STATUS_FILTER_READ = "read";

export const NOTIFICATION_STATUS_FILTER_VALUES = Object.freeze([
  NOTIFICATION_STATUS_FILTER_ALL,
  NOTIFICATION_STATUS_FILTER_UNREAD,
  NOTIFICATION_STATUS_FILTER_READ,
]);
