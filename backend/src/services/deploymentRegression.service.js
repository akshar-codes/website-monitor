import mongoose from "mongoose";
import DeploymentAlertState, {
  REGRESSION_TYPES,
  REGRESSION_STATUSES,
  DEFAULT_CORRELATION_DISCLAIMER,
} from "../models/DeploymentAlertState.js";
import DeploymentEvent from "../models/DeploymentEvent.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import Incident from "../models/Incident.js";
import {
  calculateCheckStats,
  calculateMetricDiffs,
} from "./deployment.service.js";
import { createNotification } from "./notification.service.js";
import { logActivity } from "../utils/activityLogger.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} from "../config/notificationConstants.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_ACTIONS,
} from "../config/activityConstants.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

export const DEFAULT_REGRESSION_CONFIG = Object.freeze({
  windowMinutes: 30, // 30 minutes before and 30 minutes after
  minSampleCount: 3, // At least 3 scheduled checks before and after
  medianLatencyIncreaseMs: 30, // Minimum 30ms degradation
  medianLatencyIncreasePercent: 20, // Minimum 20% degradation
  p95LatencyIncreaseMs: 50, // Minimum 50ms degradation
  p95LatencyIncreasePercent: 25, // Minimum 25% degradation
  failureRateIncreasePercent: 5.0, // Minimum +5% failure rate increase
  availabilityDropPercent: 5.0, // Minimum 5% availability drop
  cooldownMinutes: 60, // 60 minutes deduplication cooldown
});

/**
 * Validates and normalizes regression detection configuration.
 */
export const validateRegressionConfig = (config = {}) => {
  const merged = { ...DEFAULT_REGRESSION_CONFIG, ...config };

  const windowMinutes = Number(merged.windowMinutes);
  if (isNaN(windowMinutes) || windowMinutes < 5 || windowMinutes > 1440) {
    throw ApiError.badRequest(
      "Evaluation window must be between 5 and 1440 minutes",
    );
  }

  const minSampleCount = Number(merged.minSampleCount);
  if (isNaN(minSampleCount) || minSampleCount < 1 || minSampleCount > 100) {
    throw ApiError.badRequest(
      "Minimum sample count must be an integer between 1 and 100",
    );
  }

  const medianMs = Number(merged.medianLatencyIncreaseMs);
  const medianPct = Number(merged.medianLatencyIncreasePercent);
  if (isNaN(medianMs) || medianMs < 0 || isNaN(medianPct) || medianPct < 0) {
    throw ApiError.badRequest(
      "Median latency increase thresholds must be non-negative numbers",
    );
  }

  const p95Ms = Number(merged.p95LatencyIncreaseMs);
  const p95Pct = Number(merged.p95LatencyIncreasePercent);
  if (isNaN(p95Ms) || p95Ms < 0 || isNaN(p95Pct) || p95Pct < 0) {
    throw ApiError.badRequest(
      "P95 latency increase thresholds must be non-negative numbers",
    );
  }

  const failureRate = Number(merged.failureRateIncreasePercent);
  if (isNaN(failureRate) || failureRate < 0 || failureRate > 100) {
    throw ApiError.badRequest(
      "Failure rate increase threshold must be between 0 and 100",
    );
  }

  const availabilityDrop = Number(merged.availabilityDropPercent);
  if (
    isNaN(availabilityDrop) ||
    availabilityDrop < 0 ||
    availabilityDrop > 100
  ) {
    throw ApiError.badRequest(
      "Availability drop threshold must be between 0 and 100",
    );
  }

  const cooldownMinutes = Number(merged.cooldownMinutes);
  if (isNaN(cooldownMinutes) || cooldownMinutes < 1 || cooldownMinutes > 1440) {
    throw ApiError.badRequest("Cooldown must be between 1 and 1440 minutes");
  }

  return {
    windowMinutes: Math.round(windowMinutes),
    minSampleCount: Math.round(minSampleCount),
    medianLatencyIncreaseMs: medianMs,
    medianLatencyIncreasePercent: medianPct,
    p95LatencyIncreaseMs: p95Ms,
    p95LatencyIncreasePercent: p95Pct,
    failureRateIncreasePercent: failureRate,
    availabilityDropPercent: availabilityDrop,
    cooldownMinutes: Math.round(cooldownMinutes),
  };
};

/**
 * Classifies regression type based on observed degradation signals.
 */
export const classifyRegressionType = ({
  hasLatency,
  hasFailure,
  hasIncident,
}) => {
  const signalCount =
    (hasLatency ? 1 : 0) + (hasFailure ? 1 : 0) + (hasIncident ? 1 : 0);
  if (signalCount > 1) return REGRESSION_TYPES.COMBINED;
  if (hasIncident) return REGRESSION_TYPES.INCIDENT;
  if (hasFailure) return REGRESSION_TYPES.FAILURE_RATE;
  if (hasLatency) return REGRESSION_TYPES.LATENCY;
  return REGRESSION_TYPES.COMBINED;
};

/**
 * Evaluates empirical evidence for post-deployment regression.
 * Strictly adheres to temporal correlation without claiming proven root causation.
 */
export const evaluateRegressionSignals = ({
  beforeStats,
  afterStats,
  diff,
  relatedIncidents = [],
  config,
  isWindowIncomplete,
}) => {
  const evidence = [];
  let hasLatency = false;
  let hasFailure = false;
  let hasIncident = false;

  // 1. Post-deployment incidents
  const postDeployIncidents = relatedIncidents.filter(
    (inc) => inc.timingRelation === "started_after_deployment",
  );
  if (postDeployIncidents.length > 0) {
    hasIncident = true;
    evidence.push(
      `${postDeployIncidents.length} incident${
        postDeployIncidents.length > 1 ? "s" : ""
      } opened following release deployment.`,
    );
  }

  // 2. Elevated failure rates or drop in availability
  if (
    diff.failureRateChange != null &&
    diff.failureRateChange >= config.failureRateIncreasePercent
  ) {
    hasFailure = true;
    evidence.push(
      `Failure rate elevated by +${diff.failureRateChange}% (from ${beforeStats.failureRate}% to ${afterStats.failureRate}%, ${afterStats.failedChecks} failed checks).`,
    );
  } else if (
    beforeStats.availability != null &&
    afterStats.availability != null &&
    diff.availabilityChange != null &&
    diff.availabilityChange <= -config.availabilityDropPercent
  ) {
    hasFailure = true;
    evidence.push(
      `Availability dropped by ${diff.availabilityChange}% (from ${beforeStats.availability}% to ${afterStats.availability}%).`,
    );
  }

  // 3. Response time regression (requires sufficient samples to avoid false positives)
  const samplesSufficient =
    beforeStats.sampleCount >= config.minSampleCount &&
    afterStats.sampleCount >= config.minSampleCount;

  if (samplesSufficient) {
    if (
      diff.medianResponseTimeChangePercent != null &&
      diff.medianResponseTimeChangePercent >=
        config.medianLatencyIncreasePercent &&
      diff.medianResponseTimeChangeMs != null &&
      diff.medianResponseTimeChangeMs >= config.medianLatencyIncreaseMs
    ) {
      hasLatency = true;
      evidence.push(
        `Median response time degraded by +${diff.medianResponseTimeChangeMs} ms (+${diff.medianResponseTimeChangePercent}%) from ${beforeStats.medianResponseTime} ms to ${afterStats.medianResponseTime} ms.`,
      );
    } else if (
      diff.p95ResponseTimeChangePercent != null &&
      diff.p95ResponseTimeChangePercent >= config.p95LatencyIncreasePercent &&
      diff.p95ResponseTimeChangeMs != null &&
      diff.p95ResponseTimeChangeMs >= config.p95LatencyIncreaseMs
    ) {
      hasLatency = true;
      evidence.push(
        `P95 latency degraded by +${diff.p95ResponseTimeChangeMs} ms (+${diff.p95ResponseTimeChangePercent}%) from ${beforeStats.p95ResponseTime} ms to ${afterStats.p95ResponseTime} ms.`,
      );
    }
  }

  // 4. Data sufficiency handling
  if (!samplesSufficient) {
    if (hasIncident) {
      // Post-deployment incident is actionable even with sparse check samples
      evidence.push(
        `Sparse scheduled health check sample count (${beforeStats.sampleCount} before / ${afterStats.sampleCount} after). Latency comparisons are withheld.`,
      );
    } else {
      if (isWindowIncomplete) {
        return {
          status: REGRESSION_STATUSES.EVALUATING,
          regressionType: REGRESSION_TYPES.COMBINED,
          evidence: [
            `Evaluation window is in progress (${afterStats.sampleCount}/${config.minSampleCount} minimum post-deployment samples collected so far).`,
          ],
          hasSuspectedRegression: false,
          postDeployIncidents,
        };
      }
      return {
        status: REGRESSION_STATUSES.INSUFFICIENT_DATA,
        regressionType: REGRESSION_TYPES.COMBINED,
        evidence: [
          `Insufficient scheduled sample count (${beforeStats.sampleCount} before / ${afterStats.sampleCount} after; minimum required: ${config.minSampleCount}). Evaluation withheld to avoid false classification.`,
        ],
        hasSuspectedRegression: false,
        postDeployIncidents,
      };
    }
  }

  const hasSuspectedRegression = hasLatency || hasFailure || hasIncident;
  if (hasSuspectedRegression) {
    return {
      status: REGRESSION_STATUSES.SUSPECTED_REGRESSION,
      regressionType: classifyRegressionType({
        hasLatency,
        hasFailure,
        hasIncident,
      }),
      evidence,
      hasSuspectedRegression: true,
      postDeployIncidents,
    };
  }

  if (isWindowIncomplete) {
    return {
      status: REGRESSION_STATUSES.EVALUATING,
      regressionType: REGRESSION_TYPES.COMBINED,
      evidence: [
        `Evaluation window is still in progress. Observed metrics remain within stable operating boundaries so far.`,
      ],
      hasSuspectedRegression: false,
      postDeployIncidents,
    };
  }

  evidence.push(
    "Response times and failure rates remained stable within expected operational variance.",
  );

  return {
    status: REGRESSION_STATUSES.NORMAL,
    regressionType: REGRESSION_TYPES.COMBINED,
    evidence,
    hasSuspectedRegression: false,
    postDeployIncidents,
  };
};

/**
 * Evaluates a single deployment regression for a monitor, enforces deduplication and cooldown,
 * dispatches notifications safely, and persists the alert state.
 */
export const evaluateDeploymentRegression = async ({
  monitorId,
  deploymentId,
  options = {},
  deps = {},
}) => {
  const models = {
    DeploymentAlertState: deps.DeploymentAlertState || DeploymentAlertState,
    DeploymentEvent: deps.DeploymentEvent || DeploymentEvent,
    Monitor: deps.Monitor || Monitor,
    HealthCheck: deps.HealthCheck || HealthCheck,
    Incident: deps.Incident || Incident,
    createNotification: deps.createNotification || createNotification,
    logActivity: deps.logActivity || logActivity,
  };

  const config = validateRegressionConfig(options);
  const windowMs = config.windowMinutes * 60 * 1000;

  // 1. Fetch monitor & deployment
  const [monitor, deployment] = await Promise.all([
    models.Monitor.findById(monitorId).lean(),
    models.DeploymentEvent.findById(deploymentId).lean(),
  ]);

  if (!monitor) {
    throw ApiError.notFound("Monitor not found");
  }
  if (!deployment) {
    throw ApiError.notFound("Deployment event not found");
  }

  // Confirm monitor belongs to deployment affected monitors
  const monitorIdStr = monitor._id.toString();
  const deploymentMonitors = (deployment.monitors || []).map((m) =>
    (m._id || m).toString(),
  );
  if (!deploymentMonitors.includes(monitorIdStr)) {
    throw ApiError.badRequest(
      "The specified deployment is not associated with this monitor.",
    );
  }

  const deployedTime = new Date(deployment.deployedAt).getTime();
  const beforeStart = new Date(deployedTime - windowMs);
  const beforeEnd = new Date(deployedTime);
  const afterStart = new Date(deployedTime);
  const afterEnd = new Date(deployedTime + windowMs);

  const nowTime = Date.now();
  const effectiveAfterEnd = new Date(Math.min(afterEnd.getTime(), nowTime));
  const isWindowIncomplete = nowTime < afterEnd.getTime();

  // 2. Fetch health checks
  const [beforeChecks, afterChecks] = await Promise.all([
    models.HealthCheck.find({
      monitor: monitor._id,
      checkedAt: { $gte: beforeStart, $lt: beforeEnd },
      scheduled: true,
    })
      .select("status responseTime checkedAt")
      .sort({ checkedAt: 1 })
      .lean(),
    models.HealthCheck.find({
      monitor: monitor._id,
      checkedAt: { $gte: afterStart, $lte: effectiveAfterEnd },
      scheduled: true,
    })
      .select("status responseTime checkedAt")
      .sort({ checkedAt: 1 })
      .lean(),
  ]);

  // 3. Query overlapping incidents
  const rawIncidents = await models.Incident.find({
    monitor: monitor._id,
    startedAt: { $lte: afterEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: beforeStart } }],
  })
    .select("title message status severity startedAt endedAt duration")
    .sort({ startedAt: 1 })
    .lean();

  const relatedIncidents = rawIncidents.map((inc) => {
    const incStart = new Date(inc.startedAt).getTime();
    let timingRelation = "ongoing_during_deployment";
    if (incStart >= deployedTime) {
      timingRelation = "started_after_deployment";
    } else if (inc.endedAt && new Date(inc.endedAt).getTime() <= deployedTime) {
      timingRelation = "resolved_before_deployment";
    }
    return {
      ...inc,
      id: inc._id.toString(),
      timingRelation,
    };
  });

  // 4. Compute statistics & differences
  const beforeStats = calculateCheckStats(beforeChecks);
  const afterStats = calculateCheckStats(afterChecks);
  const diff = calculateMetricDiffs(beforeStats, afterStats);

  // 5. Evaluate regression signals
  const evaluation = evaluateRegressionSignals({
    beforeStats,
    afterStats,
    diff,
    relatedIncidents,
    config,
    isWindowIncomplete,
  });

  const {
    status,
    regressionType,
    evidence,
    hasSuspectedRegression,
    postDeployIncidents,
  } = evaluation;

  const deduplicationKey = `${deployment._id.toString()}:${monitor._id.toString()}:${regressionType}`;
  const now = new Date();
  const cooldownMs = config.cooldownMinutes * 60 * 1000;

  // 6. Upsert alert state document
  const alertState = await models.DeploymentAlertState.findOneAndUpdate(
    { deduplicationKey },
    {
      $set: {
        owner: monitor.owner,
        monitor: monitor._id,
        deployment: deployment._id,
        regressionType,
        status,
        windowMinutes: config.windowMinutes,
        thresholds: {
          minSampleCount: config.minSampleCount,
          medianLatencyIncreaseMs: config.medianLatencyIncreaseMs,
          medianLatencyIncreasePercent: config.medianLatencyIncreasePercent,
          p95LatencyIncreaseMs: config.p95LatencyIncreaseMs,
          p95LatencyIncreasePercent: config.p95LatencyIncreasePercent,
          failureRateIncreasePercent: config.failureRateIncreasePercent,
          availabilityDropPercent: config.availabilityDropPercent,
        },
        metricsSnapshot: {
          before: beforeStats,
          after: afterStats,
          diff,
        },
        evidence,
        relatedIncidents: (postDeployIncidents || []).map((i) => i._id || i.id),
        lastEvaluatedAt: now,
      },
      $setOnInsert: {
        deduplicationKey,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true,
    },
  );

  let alertDispatched = false;

  // 7. Deduplicated notification dispatch
  if (hasSuspectedRegression) {
    const isDueForAlert =
      !alertState.alertDispatchedAt ||
      (alertState.cooldownUntil && alertState.cooldownUntil <= now);

    if (isDueForAlert) {
      // Concurrency protection: atomically claim notification dispatch
      const claimedState = await models.DeploymentAlertState.findOneAndUpdate(
        {
          _id: alertState._id,
          $or: [{ alertDispatchedAt: null }, { cooldownUntil: { $lte: now } }],
        },
        {
          $set: {
            alertDispatchedAt: now,
            cooldownUntil: new Date(now.getTime() + cooldownMs),
          },
        },
        { returnDocument: "after" },
      );

      if (claimedState) {
        try {
          // Priority selection: critical if incidents opened or severe failure rate
          const isCritical =
            postDeployIncidents.length > 0 ||
            (diff.failureRateChange != null && diff.failureRateChange >= 20.0);

          const priority = isCritical
            ? NOTIFICATION_PRIORITIES.CRITICAL
            : NOTIFICATION_PRIORITIES.HIGH;

          const title = `Suspected regression: ${monitor.name} (${deployment.version})`;
          const evidenceSummary = evidence.join(" ");
          const message = `Suspected performance regression detected on monitor "${monitor.name}" following release ${deployment.version} to ${deployment.environment} (${config.windowMinutes}m comparison window). Evidence: ${evidenceSummary}`;
          const safeMessage =
            message.length > 990 ? `${message.slice(0, 987)}...` : message;

          const inAppPath = `/monitors/${monitor._id}?deploymentId=${deployment._id}`;

          await models.createNotification({
            ownerId: monitor.owner,
            type: NOTIFICATION_TYPES.DEPLOYMENT_REGRESSION,
            title,
            message: safeMessage,
            priority,
            link: inAppPath,
            dedupeKey: deduplicationKey,
            relatedResource: {
              resourceType: "DeploymentEvent",
              resourceId: deployment._id,
            },
          });

          await models.logActivity({
            userId: monitor.owner,
            category: ACTIVITY_CATEGORIES.MONITOR,
            action: ACTIVITY_ACTIONS.DEPLOYMENT_REGRESSION_DETECTED,
            description: `Suspected deployment regression detected for monitor "${monitor.name}" following release ${deployment.version}`,
            entityType: "Monitor",
            entityId: monitor._id,
            metadata: {
              deploymentId: deployment._id,
              version: deployment.version,
              environment: deployment.environment,
              regressionType,
              windowMinutes: config.windowMinutes,
            },
          });

          alertDispatched = true;
        } catch (dispatchErr) {
          logger.error(
            "Failed to dispatch deployment regression notification",
            {
              deduplicationKey,
              error: dispatchErr.message,
            },
          );
          // Record error without crashing the evaluation
          await models.DeploymentAlertState.updateOne(
            { _id: alertState._id },
            {
              $set: { lastError: dispatchErr.message },
              $inc: { retryCount: 1 },
            },
          );
        }
      }
    }
  }

  return {
    alertState,
    evaluation: {
      status,
      regressionType,
      evidence,
      hasSuspectedRegression,
      disclaimer: DEFAULT_CORRELATION_DISCLAIMER,
    },
    metrics: {
      before: beforeStats,
      after: afterStats,
      diff,
    },
    window: {
      windowMinutes: config.windowMinutes,
      isWindowIncomplete,
      beforeStart,
      beforeEnd,
      afterStart,
      afterEnd,
    },
    alertDispatched,
  };
};

/**
 * Hook for scheduled health checks:
 * Scans for recent deployments affecting this monitor that are in the evaluation window
 * and evaluates them asynchronously.
 */
export const evaluateMonitorDeploymentRegressions = async (
  monitor,
  check,
  deps = {},
) => {
  if (!monitor || !check || !check.scheduled) return null;

  const models = {
    DeploymentEvent: deps.DeploymentEvent || DeploymentEvent,
  };

  const checkTime = new Date(check.checkedAt || Date.now()).getTime();
  // Look back up to 2 hours for deployments that may be evaluating
  const maxLookbackMs = 2 * 60 * 60 * 1000;
  const since = new Date(checkTime - maxLookbackMs);

  const activeDeployments = await models.DeploymentEvent.find({
    monitors: monitor._id,
    deployedAt: { $gte: since, $lte: new Date(checkTime) },
  })
    .select("_id deployedAt version")
    .sort({ deployedAt: -1 })
    .limit(5)
    .lean();

  if (!activeDeployments.length) return null;

  const results = [];
  for (const dep of activeDeployments) {
    try {
      const res = await evaluateDeploymentRegression({
        monitorId: monitor._id,
        deploymentId: dep._id,
        options: {},
        deps,
      });
      results.push(res);
    } catch (err) {
      logger.warn("Monitor deployment regression evaluation step failed", {
        monitorId: monitor._id,
        deploymentId: dep._id,
        error: err.message,
      });
    }
  }

  return results;
};

/**
 * Worker / background job method:
 * Finds pending deployments from recent hours and evaluates any due regression checks.
 */
export const evaluatePendingDeploymentRegressions = async (
  options = {},
  deps = {},
) => {
  const models = {
    DeploymentEvent: deps.DeploymentEvent || DeploymentEvent,
    DeploymentAlertState: deps.DeploymentAlertState || DeploymentAlertState,
  };

  const lookbackHours = options.lookbackHours || 24;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const deployments = await models.DeploymentEvent.find({
    deployedAt: { $gte: since },
  })
    .select("_id monitors deployedAt")
    .sort({ deployedAt: -1 })
    .limit(50)
    .lean();

  let evaluatedCount = 0;
  let regressionsFound = 0;

  for (const dep of deployments) {
    for (const monitorId of dep.monitors || []) {
      try {
        const res = await evaluateDeploymentRegression({
          monitorId: monitorId._id || monitorId,
          deploymentId: dep._id,
          options,
          deps,
        });
        evaluatedCount++;
        if (res.evaluation?.hasSuspectedRegression) {
          regressionsFound++;
        }
      } catch (err) {
        logger.warn("Pending deployment regression evaluation failed", {
          deploymentId: dep._id,
          monitorId,
          error: err.message,
        });
      }
    }
  }

  return { evaluatedCount, regressionsFound };
};

/**
 * Fetches the stored regression alert state for a specific monitor and deployment.
 */
export const getDeploymentRegressionState = async (
  monitorId,
  deploymentId,
  user,
) => {
  const userId = (user.id || user._id)?.toString();
  const alertState = await DeploymentAlertState.findOne({
    monitor: monitorId,
    deployment: deploymentId,
    owner: userId,
  })
    .populate(
      "relatedIncidents",
      "title status severity startedAt endedAt duration",
    )
    .lean();

  return alertState || null;
};
