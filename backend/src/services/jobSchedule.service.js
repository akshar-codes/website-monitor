import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Cron } from "croner";
import {
  JOB_SCHEDULE_TYPES,
  JOB_SCHEDULE_TYPE_VALUES,
  JOB_MONITOR_LIMITS,
} from "../config/constants.js";

/**
 * Validates whether a given string is a valid cron expression using Croner.
 * Supports standard 5-field cron, step values, lists, ranges, and nicknames.
 *
 * @param {string} expression
 * @returns {boolean}
 */
export const isValidCron = (expression) => {
  if (typeof expression !== "string" || !expression.trim()) return false;
  try {
    const cron = new Cron(expression.trim());
    return Boolean(cron.nextRun());
  } catch {
    return false;
  }
};

/**
 * Validates whether a string is a recognized IANA timezone identifier
 * using the platform's native Intl API.
 *
 * @param {string} timezone
 * @returns {boolean}
 */
export const isValidTimezone = (timezone) => {
  if (typeof timezone !== "string" || !timezone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone.trim() });
    return true;
  } catch {
    return false;
  }
};

/**
 * Validates full schedule configuration and bounds.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validateScheduleConfig = (config = {}) => {
  const errors = [];
  const {
    scheduleType,
    intervalSeconds,
    cronExpression,
    timezone = "UTC",
    gracePeriodSeconds = JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS,
    runTimeoutSeconds = JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS,
    failureThreshold = JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD,
    recoveryThreshold = JOB_MONITOR_LIMITS.DEFAULT_RECOVERY_THRESHOLD,
  } = config;

  if (!JOB_SCHEDULE_TYPE_VALUES.includes(scheduleType)) {
    errors.push(
      `Invalid scheduleType "${scheduleType}". Must be one of: ${JOB_SCHEDULE_TYPE_VALUES.join(", ")}`,
    );
  }

  if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
    if (
      typeof intervalSeconds !== "number" ||
      !Number.isInteger(intervalSeconds)
    ) {
      errors.push("intervalSeconds must be an integer");
    } else if (
      intervalSeconds < JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS ||
      intervalSeconds > JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS
    ) {
      errors.push(
        `intervalSeconds must be between ${JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS} and ${JOB_MONITOR_LIMITS.MAX_INTERVAL_SECONDS} seconds`,
      );
    }
  } else if (scheduleType === JOB_SCHEDULE_TYPES.CRON) {
    if (!cronExpression || typeof cronExpression !== "string") {
      errors.push("cronExpression is required for cron schedules");
    } else if (!isValidCron(cronExpression)) {
      errors.push(`"${cronExpression}" is not a valid cron expression`);
    }
  }

  if (timezone && !isValidTimezone(timezone)) {
    errors.push(`"${timezone}" is not a recognized IANA timezone`);
  }

  if (typeof gracePeriodSeconds === "number") {
    if (
      gracePeriodSeconds < JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS ||
      gracePeriodSeconds > JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS
    ) {
      errors.push(
        `gracePeriodSeconds must be between ${JOB_MONITOR_LIMITS.MIN_GRACE_PERIOD_SECONDS} and ${JOB_MONITOR_LIMITS.MAX_GRACE_PERIOD_SECONDS}`,
      );
    }
  }

  if (typeof runTimeoutSeconds === "number") {
    if (
      runTimeoutSeconds < JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS ||
      runTimeoutSeconds > JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS
    ) {
      errors.push(
        `runTimeoutSeconds must be between ${JOB_MONITOR_LIMITS.MIN_RUN_TIMEOUT_SECONDS} and ${JOB_MONITOR_LIMITS.MAX_RUN_TIMEOUT_SECONDS}`,
      );
    }
  }

  if (typeof failureThreshold === "number") {
    if (
      failureThreshold < JOB_MONITOR_LIMITS.MIN_FAILURE_THRESHOLD ||
      failureThreshold > JOB_MONITOR_LIMITS.MAX_FAILURE_THRESHOLD
    ) {
      errors.push(
        `failureThreshold must be between ${JOB_MONITOR_LIMITS.MIN_FAILURE_THRESHOLD} and ${JOB_MONITOR_LIMITS.MAX_FAILURE_THRESHOLD}`,
      );
    }
  }

  if (typeof recoveryThreshold === "number") {
    if (
      recoveryThreshold < JOB_MONITOR_LIMITS.MIN_RECOVERY_THRESHOLD ||
      recoveryThreshold > JOB_MONITOR_LIMITS.MAX_RECOVERY_THRESHOLD
    ) {
      errors.push(
        `recoveryThreshold must be between ${JOB_MONITOR_LIMITS.MIN_RECOVERY_THRESHOLD} and ${JOB_MONITOR_LIMITS.MAX_RECOVERY_THRESHOLD}`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Calculates the next scheduled execution time strictly after fromDate.
 * Correctly accounts for IANA timezones and daylight-saving shifts.
 *
 * @param {object} schedule
 * @param {Date|number|string} [fromDate=new Date()]
 * @returns {Date} UTC Date of next execution occurrence
 */
export const calculateNextRun = (
  { scheduleType, intervalSeconds, cronExpression, timezone = "UTC" },
  fromDate = new Date(),
) => {
  const base = fromDate instanceof Date ? fromDate : new Date(fromDate);
  if (isNaN(base.getTime())) {
    throw new Error("Invalid fromDate supplied for calculateNextRun");
  }

  if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
    if (
      !intervalSeconds ||
      intervalSeconds < JOB_MONITOR_LIMITS.MIN_INTERVAL_SECONDS
    ) {
      throw new Error(`Invalid intervalSeconds: ${intervalSeconds}`);
    }
    return new Date(base.getTime() + intervalSeconds * 1000);
  }

  if (scheduleType === JOB_SCHEDULE_TYPES.CRON) {
    if (!cronExpression || !isValidCron(cronExpression)) {
      throw new Error(`Invalid cronExpression: ${cronExpression}`);
    }
    const tz = timezone && isValidTimezone(timezone) ? timezone : "UTC";
    const cron = new Cron(cronExpression.trim(), { timezone: tz });
    const next = cron.nextRun(base);
    if (!next) {
      throw new Error("Cron expression produced no future run occurrences");
    }
    return next;
  }

  throw new Error(`Unsupported scheduleType: ${scheduleType}`);
};

/**
 * Calculates when the distributed scheduler worker should next evaluate
 * the monitor (checking for either missed occurrence or execution timeout).
 *
 * @param {object} state
 * @param {Date} [now=new Date()]
 * @returns {Date}
 */
export const calculateNextEvaluation = (
  {
    gracePeriodSeconds = JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS,
    runTimeoutSeconds = JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS,
    currentRunStartedAt = null,
    nextExpectedAt = null,
  },
  now = new Date(),
) => {
  const baseNow = now instanceof Date ? now : new Date(now);

  // If a run is in progress, the earliest evaluation is the execution timeout deadline
  if (currentRunStartedAt) {
    const started = new Date(currentRunStartedAt);
    if (!isNaN(started.getTime())) {
      const timeoutDeadline = new Date(
        started.getTime() + runTimeoutSeconds * 1000,
      );
      // If we also have a nextExpectedAt, check which arrives earlier
      if (nextExpectedAt) {
        const expected = new Date(nextExpectedAt);
        const missedDeadline = new Date(
          expected.getTime() + gracePeriodSeconds * 1000,
        );
        return new Date(
          Math.min(timeoutDeadline.getTime(), missedDeadline.getTime()),
        );
      }
      return timeoutDeadline;
    }
  }

  // If not running, evaluate when the expected run becomes overdue (expected + grace)
  if (nextExpectedAt) {
    const expected = new Date(nextExpectedAt);
    if (!isNaN(expected.getTime())) {
      return new Date(expected.getTime() + gracePeriodSeconds * 1000);
    }
  }

  // Fallback: evaluate after gracePeriod
  return new Date(baseNow.getTime() + gracePeriodSeconds * 1000);
};

/**
 * Handles safe schedule updates for existing job monitors.
 * Recalculates future nextExpectedAt and nextEvaluationAt starting from now,
 * preserving all historical runs.
 *
 * @param {object} jobMonitor Existing document or plain object
 * @param {object} newConfig Patch configuration
 * @param {Date} [now=new Date()]
 * @returns {object} Updated schedule and recalculated execution timestamps
 */
export const recalculateScheduleForUpdate = (
  jobMonitor,
  newConfig = {},
  now = new Date(),
) => {
  const merged = {
    scheduleType: newConfig.scheduleType || jobMonitor.scheduleType,
    intervalSeconds:
      newConfig.intervalSeconds !== undefined
        ? newConfig.intervalSeconds
        : jobMonitor.intervalSeconds,
    cronExpression:
      newConfig.cronExpression !== undefined
        ? newConfig.cronExpression
        : jobMonitor.cronExpression,
    timezone:
      newConfig.timezone !== undefined
        ? newConfig.timezone
        : jobMonitor.timezone || "UTC",
    gracePeriodSeconds:
      newConfig.gracePeriodSeconds !== undefined
        ? newConfig.gracePeriodSeconds
        : (jobMonitor.gracePeriodSeconds ??
          JOB_MONITOR_LIMITS.DEFAULT_GRACE_PERIOD_SECONDS),
    runTimeoutSeconds:
      newConfig.runTimeoutSeconds !== undefined
        ? newConfig.runTimeoutSeconds
        : (jobMonitor.runTimeoutSeconds ??
          JOB_MONITOR_LIMITS.DEFAULT_RUN_TIMEOUT_SECONDS),
    failureThreshold:
      newConfig.failureThreshold !== undefined
        ? newConfig.failureThreshold
        : (jobMonitor.failureThreshold ??
          JOB_MONITOR_LIMITS.DEFAULT_FAILURE_THRESHOLD),
    recoveryThreshold:
      newConfig.recoveryThreshold !== undefined
        ? newConfig.recoveryThreshold
        : (jobMonitor.recoveryThreshold ??
          JOB_MONITOR_LIMITS.DEFAULT_RECOVERY_THRESHOLD),
  };

  const validation = validateScheduleConfig(merged);
  if (!validation.valid) {
    throw new Error(
      `Invalid schedule configuration: ${validation.errors.join("; ")}`,
    );
  }

  const baseDate = now instanceof Date ? now : new Date(now);
  const nextExpectedAt = calculateNextRun(merged, baseDate);
  const nextEvaluationAt = calculateNextEvaluation(
    {
      ...merged,
      currentRunStartedAt: jobMonitor.currentRunStartedAt,
      nextExpectedAt,
    },
    baseDate,
  );

  return {
    ...merged,
    nextExpectedAt,
    nextEvaluationAt,
  };
};

/**
 * Generates a human-friendly description of a schedule.
 *
 * @param {object} schedule
 * @returns {string}
 */
export const formatScheduleDisplay = ({
  scheduleType,
  intervalSeconds,
  cronExpression,
  timezone = "UTC",
}) => {
  if (scheduleType === JOB_SCHEDULE_TYPES.INTERVAL) {
    if (!intervalSeconds) return "Interval not set";
    if (intervalSeconds < 60) return `Every ${intervalSeconds} seconds`;
    if (intervalSeconds === 60) return "Every minute";
    if (intervalSeconds < 3600) {
      const minutes = Math.round(intervalSeconds / 60);
      return `Every ${minutes} minutes`;
    }
    if (intervalSeconds === 3600) return "Every hour";
    if (intervalSeconds < 86400) {
      const hours = Math.round(intervalSeconds / 3600);
      return `Every ${hours} hours`;
    }
    const days = Math.round(intervalSeconds / 86400);
    return days === 1 ? "Every day" : `Every ${days} days`;
  }

  if (scheduleType === JOB_SCHEDULE_TYPES.CRON) {
    const tzStr = timezone && timezone !== "UTC" ? ` (${timezone})` : "";
    return `Cron "${cronExpression}"${tzStr}`;
  }

  return "Unknown schedule";
};

/**
 * Generates a high-entropy reporting token and its SHA-256 hash.
 * The raw token is returned once to the caller; only the prefix and hash
 * are stored in the database.
 *
 * @returns {{ token: string, prefix: string, tokenHash: string }}
 */
export const generateJobToken = () => {
  const identifier = randomBytes(6).toString("hex");
  const prefix = `jm_live_${identifier}`;
  const secret = randomBytes(24).toString("base64url");
  const token = `${prefix}_${secret}`;
  const tokenHash = hashJobToken(token);
  return { token, prefix, tokenHash };
};

/**
 * Hashes a job reporting token using SHA-256.
 *
 * @param {string} token
 * @returns {string} Hexadecimal hash
 */
export const hashJobToken = (token) => {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Token string is required for hashing");
  }
  return createHash("sha256").update(token.trim()).digest("hex");
};

/**
 * Extracts the public identifier prefix from a full reporting token.
 *
 * @param {string} token
 * @returns {string|null}
 */
export const extractTokenPrefix = (token) => {
  if (typeof token !== "string") return null;
  const match = token.trim().match(/^(jm_live_[a-f0-9]{12})/i);
  return match ? match[1] : null;
};

/**
 * Constant-time comparison of two token hashes to prevent timing attacks.
 *
 * @param {string} hashA
 * @param {string} hashB
 * @returns {boolean}
 */
export const compareTokenHashes = (hashA, hashB) => {
  if (typeof hashA !== "string" || typeof hashB !== "string") return false;
  if (hashA.length !== hashB.length) return false;
  try {
    return timingSafeEqual(Buffer.from(hashA), Buffer.from(hashB));
  } catch {
    return false;
  }
};

/**
 * Sanitizes and bounds standard output/error text for storage in JobRun.
 *
 * @param {*} output
 * @param {number} [maxLength=5000]
 * @returns {string|null}
 */
export const sanitizeRunOutput = (output, maxLength = 5000) => {
  if (output == null) return null;
  let text = typeof output === "string" ? output : String(output);
  text = text.replace(/\0/g, "").trim();
  if (text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
};

/**
 * Sanitizes and bounds custom metadata payload for storage in JobRun.
 * Limits key count, key lengths, and value sizes to prevent memory attacks.
 *
 * @param {*} metadata
 * @param {number} [maxKeys=20]
 * @returns {object|null}
 */
export const sanitizeRunMetadata = (metadata, maxKeys = 20) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const sanitized = {};
  const entries = Object.entries(metadata).slice(0, maxKeys);

  for (const [key, val] of entries) {
    const cleanKey = String(key).slice(0, 64).trim();
    if (!cleanKey) continue;

    if (
      typeof val === "string" ||
      typeof val === "number" ||
      typeof val === "boolean" ||
      val === null
    ) {
      sanitized[cleanKey] =
        typeof val === "string" ? val.slice(0, 500).trim() : val;
    } else if (typeof val === "object") {
      try {
        sanitized[cleanKey] = JSON.parse(
          JSON.stringify(val, (_k, v) =>
            typeof v === "string" ? v.slice(0, 500) : v,
          ),
        );
      } catch {
        sanitized[cleanKey] = String(val).slice(0, 500);
      }
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
};
