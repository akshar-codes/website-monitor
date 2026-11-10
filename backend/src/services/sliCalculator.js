import { SLO_ROLLING_WINDOW_MS } from "../config/constants.js";

export const CALCULATION_VERSION = 1;

/**
 * Pure deterministic SLI calculation function.
 * Independent of database, network, or HTTP frameworks.
 *
 * @param {Array<Object>|AsyncIterable<Object>} checks - Health check records ordered by checkedAt ascending.
 * @param {Object} options - Calculation configuration.
 * @returns {Promise<Object>} Detailed SLI and error budget evaluation breakdown.
 */
export async function calculateSliFromChecks(checks, options = {}) {
  const {
    targetPercentage = 99.9,
    rollingWindow = "30d",
    windowEnd = new Date(),
    monitorCreatedAt = null,
    planRetentionDays = null,
    monitorInterval = 300,
    maxIntervalAttributionSeconds = 3600,
    minimumDataCoveragePercent = 95.0,
    excludeMaintenance = true,
    countDegradedAsDown = true,
    maintenanceWindows = [],
    budgetWarningThresholdPercent = 20,
  } = options;

  const tEnd =
    windowEnd instanceof Date
      ? windowEnd.getTime()
      : new Date(windowEnd).getTime();
  const windowDurationMs =
    SLO_ROLLING_WINDOW_MS[rollingWindow] || 30 * 86400000;
  const tNominalStart = tEnd - windowDurationMs;

  // Clamping effective window start based on monitor age and subscription plan data retention
  let tEffectiveStart = tNominalStart;

  if (monitorCreatedAt) {
    const tCreated =
      monitorCreatedAt instanceof Date
        ? monitorCreatedAt.getTime()
        : new Date(monitorCreatedAt).getTime();
    if (tCreated > tEffectiveStart) {
      tEffectiveStart = tCreated;
    }
  }

  if (planRetentionDays && planRetentionDays > 0) {
    const tRetentionLimit = tEnd - planRetentionDays * 86400000;
    if (tRetentionLimit > tEffectiveStart) {
      tEffectiveStart = tRetentionLimit;
    }
  }

  const totalWindowSeconds = Math.max(1, Math.round(windowDurationMs / 1000));
  const effectiveWindowSeconds = Math.max(
    1,
    Math.round((tEnd - tEffectiveStart) / 1000),
  );

  // Determine attribution ceiling
  const configuredMax = Math.max(
    30,
    Number(maxIntervalAttributionSeconds) || 3600,
  );
  const capIntervalSeconds = Math.max(
    configuredMax,
    Math.max(2 * monitorInterval, 600),
  );

  // Helper to determine if a given timestamp falls within an excluded maintenance window
  const isInMaintenance = (timestampMs) => {
    if (
      !excludeMaintenance ||
      !Array.isArray(maintenanceWindows) ||
      maintenanceWindows.length === 0
    ) {
      return false;
    }
    return maintenanceWindows.some((mw) => {
      const start =
        mw.scheduledStart instanceof Date
          ? mw.scheduledStart.getTime()
          : new Date(mw.scheduledStart).getTime();
      const end =
        mw.scheduledEnd instanceof Date
          ? mw.scheduledEnd.getTime()
          : new Date(mw.scheduledEnd).getTime();
      return timestampMs >= start && timestampMs <= end;
    });
  };

  let goodDurationSeconds = 0;
  let badDurationSeconds = 0;
  let unknownDurationSeconds = 0;
  let maintenanceDurationSeconds = 0;

  let sampleCount = 0;
  let goodChecks = 0;
  let badChecks = 0;
  let degradedChecks = 0;
  let unknownChecks = 0;

  let previousCheckedAtMs = null;
  let firstCheckedAtMs = null;
  let lastCheckedAtMs = null;

  // Process checks in chronological sequence (iterable or array)
  for await (const check of checks) {
    if (!check || !check.checkedAt) continue;

    const checkedAtMs =
      check.checkedAt instanceof Date
        ? check.checkedAt.getTime()
        : new Date(check.checkedAt).getTime();

    // Ignore checks completely outside effective evaluation window
    if (checkedAtMs < tEffectiveStart || checkedAtMs > tEnd) {
      continue;
    }

    sampleCount += 1;
    if (!firstCheckedAtMs) firstCheckedAtMs = checkedAtMs;
    lastCheckedAtMs = checkedAtMs;

    const sampleInterval = Math.max(
      1,
      Number(check.intervalSeconds) || monitorInterval,
    );

    let deltaSeconds;
    if (previousCheckedAtMs === null) {
      // First check in window: attribute its configured sample interval, bounded by window start
      const timeSinceWindowStart = Math.max(
        0,
        (checkedAtMs - tEffectiveStart) / 1000,
      );
      deltaSeconds = Math.min(
        sampleInterval,
        timeSinceWindowStart || sampleInterval,
      );
    } else {
      deltaSeconds = Math.max(0, (checkedAtMs - previousCheckedAtMs) / 1000);
    }

    // Interval attribution bounding: single check cannot claim > capIntervalSeconds
    const attributedSeconds = Math.min(deltaSeconds, capIntervalSeconds);
    const unobservedGap = Math.max(0, deltaSeconds - capIntervalSeconds);

    if (unobservedGap > 0) {
      unknownDurationSeconds += unobservedGap;
    }

    previousCheckedAtMs = checkedAtMs;

    // Check classification
    const status = String(check.status || "").toLowerCase();
    const inMaint = isInMaintenance(checkedAtMs);

    if (inMaint) {
      maintenanceDurationSeconds += attributedSeconds;
    } else if (status === "up") {
      goodChecks += 1;
      goodDurationSeconds += attributedSeconds;
    } else if (status === "down") {
      badChecks += 1;
      badDurationSeconds += attributedSeconds;
    } else if (status === "degraded") {
      degradedChecks += 1;
      if (countDegradedAsDown) {
        badDurationSeconds += attributedSeconds;
      } else {
        goodDurationSeconds += attributedSeconds;
      }
    } else {
      unknownChecks += 1;
      unknownDurationSeconds += attributedSeconds;
    }
  }

  // Handle leading edge gap: time between tEffectiveStart and first observation
  if (firstCheckedAtMs !== null) {
    const leadingGapSeconds = Math.max(
      0,
      (firstCheckedAtMs - tEffectiveStart) / 1000,
    );
    const leadingExcess = Math.max(0, leadingGapSeconds - capIntervalSeconds);
    if (leadingExcess > 0) {
      unknownDurationSeconds += leadingExcess;
    }
  } else {
    // Zero checks in the entire effective window
    unknownDurationSeconds += effectiveWindowSeconds;
  }

  // Handle trailing edge gap: time between last observation and window end
  if (lastCheckedAtMs !== null) {
    const trailingGapSeconds = Math.max(0, (tEnd - lastCheckedAtMs) / 1000);
    const trailingAttributed = Math.min(trailingGapSeconds, capIntervalSeconds);
    const trailingExcess = Math.max(0, trailingGapSeconds - capIntervalSeconds);

    if (trailingExcess > 0) {
      unknownDurationSeconds += trailingExcess;
    }

    // Extend latest observed state over the normal, non-stale trailing interval if within ceiling
    if (trailingAttributed > 0 && sampleCount > 0) {
      const isTrailingMaint = isInMaintenance(tEnd);
      // If trailing gap exceeds capIntervalSeconds, trailing is considered stale/unobserved
      if (trailingGapSeconds <= capIntervalSeconds) {
        // Attribute trailing duration proportionally or as unknown if stale
        // Safe SRE pattern: if last check was recent (<= monitorInterval * 2), attribute to last state
        if (trailingGapSeconds <= Math.max(2 * monitorInterval, 60)) {
          if (isTrailingMaint) {
            maintenanceDurationSeconds += trailingAttributed;
          } else if (badChecks > 0 && lastCheckedAtMs && goodChecks === 0) {
            badDurationSeconds += trailingAttributed;
          } else {
            goodDurationSeconds += trailingAttributed;
          }
        } else {
          unknownDurationSeconds += trailingAttributed;
        }
      }
    }
  }

  // Round durations to integers
  goodDurationSeconds = Math.round(goodDurationSeconds);
  badDurationSeconds = Math.round(badDurationSeconds);
  unknownDurationSeconds = Math.round(unknownDurationSeconds);
  maintenanceDurationSeconds = Math.round(maintenanceDurationSeconds);

  // Eligible window excludes scheduled maintenance
  const eligibleWindowSeconds = Math.max(
    1,
    effectiveWindowSeconds - maintenanceDurationSeconds,
  );

  // Observed duration is valid observed time (good + bad)
  const observedDurationSeconds = goodDurationSeconds + badDurationSeconds;

  // Data coverage percentage: observed time over eligible window
  const coveragePercentage = Math.min(
    100,
    Number(
      ((observedDurationSeconds / eligibleWindowSeconds) * 100).toFixed(2),
    ),
  );

  // SLI percentage: good duration over observed duration
  const sliPercentage =
    observedDurationSeconds > 0
      ? Number(
          ((goodDurationSeconds / observedDurationSeconds) * 100).toFixed(4),
        )
      : null;

  // Allowed error budget: (1 - target% / 100) * eligibleWindowSeconds
  const allowedDowntimeFraction = Math.max(0, 1 - targetPercentage / 100);
  const allowedBudgetSeconds = Math.round(
    allowedDowntimeFraction * eligibleWindowSeconds,
  );

  // Consumed budget is verified bad duration
  const consumedBudgetSeconds = badDurationSeconds;

  // Remaining budget in seconds (can be negative if breached!)
  const remainingBudgetSeconds = allowedBudgetSeconds - consumedBudgetSeconds;

  // Budget consumption percentage: (consumed / allowed) * 100
  let budgetConsumptionPercentage;
  if (allowedBudgetSeconds > 0) {
    budgetConsumptionPercentage = Number(
      ((consumedBudgetSeconds / allowedBudgetSeconds) * 100).toFixed(2),
    );
  } else {
    budgetConsumptionPercentage = consumedBudgetSeconds > 0 ? 100 : 0;
  }

  // Remaining budget percentage: 100 - budgetConsumptionPercentage (can be negative!)
  const remainingBudgetPercentage = Number(
    (100 - budgetConsumptionPercentage).toFixed(2),
  );

  // Evaluation status determination
  let status;
  if (
    coveragePercentage < minimumDataCoveragePercent ||
    observedDurationSeconds === 0 ||
    sampleCount === 0
  ) {
    status = "insufficient_data";
  } else if (
    consumedBudgetSeconds > allowedBudgetSeconds ||
    (sliPercentage !== null && sliPercentage < targetPercentage)
  ) {
    status = "breached";
  } else if (remainingBudgetPercentage <= budgetWarningThresholdPercent) {
    status = "warning";
  } else {
    status = "healthy";
  }

  return {
    windowStart: new Date(tNominalStart),
    windowEnd: new Date(tEnd),
    effectiveWindowStart: new Date(tEffectiveStart),
    totalWindowSeconds,
    effectiveWindowSeconds,
    eligibleWindowSeconds,
    goodDurationSeconds,
    badDurationSeconds,
    unknownDurationSeconds,
    maintenanceDurationSeconds,
    observedDurationSeconds,
    coveragePercentage,
    sliPercentage,
    allowedBudgetSeconds,
    consumedBudgetSeconds,
    remainingBudgetSeconds,
    remainingBudgetPercentage,
    budgetConsumptionPercentage,
    status,
    sampleCount,
    goodChecks,
    badChecks,
    degradedChecks,
    unknownChecks,
    calculationVersion: CALCULATION_VERSION,
    metadata: {
      targetPercentage,
      rollingWindow,
      monitorInterval,
      capIntervalSeconds,
      minimumDataCoveragePercent,
      excludeMaintenance,
      countDegradedAsDown,
      maintenanceWindowCount: Array.isArray(maintenanceWindows)
        ? maintenanceWindows.length
        : 0,
      isClampedByCreation: monitorCreatedAt && tEffectiveStart > tNominalStart,
      isClampedByRetention:
        planRetentionDays && tEffectiveStart > tNominalStart,
    },
  };
}
