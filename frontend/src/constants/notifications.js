/**
 * Client-side mirror of backend/src/config/notificationConstants.js, with
 * UI labels attached — same pattern already used for ROLES/PLANS in this
 * codebase (small, rarely-changing enums kept manually in sync).
 */

export const NOTIFICATION_CATEGORIES = Object.freeze({
  MONITOR: "monitor",
  INCIDENT: "incident",
  BILLING: "billing",
  ACCOUNT: "account",
  SYSTEM: "system",
});

export const CATEGORY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Monitors", value: NOTIFICATION_CATEGORIES.MONITOR },
  { label: "Incidents", value: NOTIFICATION_CATEGORIES.INCIDENT },
  { label: "Billing", value: NOTIFICATION_CATEGORIES.BILLING },
  { label: "Account", value: NOTIFICATION_CATEGORIES.ACCOUNT },
  { label: "System", value: NOTIFICATION_CATEGORIES.SYSTEM },
];

export const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Read", value: "read" },
];

export const NOTIFICATION_PRIORITIES = Object.freeze({
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  CRITICAL: "critical",
});
