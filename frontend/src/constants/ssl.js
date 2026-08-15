/**
 * Client-side mirror of backend/src/config/sslConstants.js, with UI
 * labels/tones attached — same pattern already used for
 * ROLES/PLANS/ACTIVITY/NOTIFICATIONS in this codebase (small,
 * rarely-changing enums kept manually in sync).
 */

export const SSL_STATUS = Object.freeze({
  VALID: "valid",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  INVALID: "invalid",
  UNREACHABLE: "unreachable",
  NOT_APPLICABLE: "not_applicable",
  PENDING: "pending",
});

export const DOMAIN_STATUS = Object.freeze({
  ACTIVE: "active",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  UNKNOWN: "unknown",
});

export const SSL_EXPIRY_THRESHOLDS = Object.freeze({
  CRITICAL_DAYS: 7,
  WARNING_DAYS: 30,
});

export const DOMAIN_EXPIRY_THRESHOLDS = Object.freeze({
  CRITICAL_DAYS: 14,
  WARNING_DAYS: 30,
});

export const SSL_STATUS_CONFIG = Object.freeze({
  [SSL_STATUS.VALID]: { label: "Valid", tone: "success" },
  [SSL_STATUS.EXPIRING_SOON]: { label: "Expiring Soon", tone: "warning" },
  [SSL_STATUS.EXPIRED]: { label: "Expired", tone: "danger" },
  [SSL_STATUS.INVALID]: { label: "Invalid", tone: "danger" },
  [SSL_STATUS.UNREACHABLE]: { label: "Unreachable", tone: "danger" },
  [SSL_STATUS.NOT_APPLICABLE]: { label: "Not Applicable", tone: "neutral" },
  [SSL_STATUS.PENDING]: { label: "Pending", tone: "neutral" },
});

export const DOMAIN_STATUS_CONFIG = Object.freeze({
  [DOMAIN_STATUS.ACTIVE]: { label: "Active", tone: "success" },
  [DOMAIN_STATUS.EXPIRING_SOON]: { label: "Expiring Soon", tone: "warning" },
  [DOMAIN_STATUS.EXPIRED]: { label: "Expired", tone: "danger" },
  [DOMAIN_STATUS.UNKNOWN]: { label: "Unknown", tone: "neutral" },
});

/**
 * Days-remaining -> urgency tone, independent of the persisted status
 * string — used anywhere a raw number needs its own color coding (e.g.
 * the expiry countdown ring).
 */
export function daysRemainingTone(daysRemaining) {
  if (daysRemaining == null) return "neutral";
  if (daysRemaining < 0) return "danger";
  if (daysRemaining <= SSL_EXPIRY_THRESHOLDS.CRITICAL_DAYS) return "danger";
  if (daysRemaining <= SSL_EXPIRY_THRESHOLDS.WARNING_DAYS) return "warning";
  return "success";
}
