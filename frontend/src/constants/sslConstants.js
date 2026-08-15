/**
 * Single source of truth for SSL/TLS and domain monitoring enums and
 * thresholds. Mirrors the pattern in config/preferenceConstants.js and
 * config/activityConstants.js — flat enum objects plus derived
 * `_VALUES` arrays for Zod schemas and Mongoose enum validators.
 */

/** Overall certificate status, derived from a live TLS check. */
export const SSL_STATUS = Object.freeze({
  VALID: "valid",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  INVALID: "invalid",
  UNREACHABLE: "unreachable",
  NOT_APPLICABLE: "not_applicable",
  PENDING: "pending",
});

export const SSL_STATUS_VALUES = Object.freeze(Object.values(SSL_STATUS));

/** Domain registration status, derived from an RDAP lookup. */
export const DOMAIN_STATUS = Object.freeze({
  ACTIVE: "active",
  EXPIRING_SOON: "expiring_soon",
  EXPIRED: "expired",
  UNKNOWN: "unknown",
});

export const DOMAIN_STATUS_VALUES = Object.freeze(Object.values(DOMAIN_STATUS));

/**
 * Days-remaining thresholds used to classify certificate expiry urgency.
 * A certificate at or under CRITICAL_DAYS is still reported as
 * "expiring_soon" (there is no separate "critical" status enum) — the
 * distinction is surfaced to the UI via the raw `daysRemaining` number
 * instead, so the backend never has to invent additional status values
 * every time a new UI treatment is wanted.
 */
export const SSL_EXPIRY_THRESHOLDS = Object.freeze({
  CRITICAL_DAYS: 7,
  WARNING_DAYS: 30,
});

/** Days-remaining thresholds used to classify domain registration expiry urgency. */
export const DOMAIN_EXPIRY_THRESHOLDS = Object.freeze({
  CRITICAL_DAYS: 14,
  WARNING_DAYS: 30,
});
