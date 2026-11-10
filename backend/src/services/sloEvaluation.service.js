import Slo from "../models/Slo.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import SloSnapshot from "../models/SloSnapshot.js";
import StatusPage from "../models/StatusPage.js";
import StatusMaintenance from "../models/StatusMaintenance.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { ROLES, SLO_ROLLING_WINDOW_MS } from "../config/constants.js";
import { getPlanDefinition } from "../config/plans.js";
import { calculateSliFromChecks } from "./sliCalculator.js";
import { processSloAlerts, getSloAlertState } from "./sloAlert.service.js";
import logger from "../utils/logger.js";

const resolveOwnerId = (user) => (user.id || user._id).toString();

/**
 * Resolves active/completed maintenance windows covering the evaluation range.
 */
export async function getMonitorMaintenanceWindows(
  monitorId,
  windowStart,
  windowEnd,
) {
  try {
    const statusPages = await StatusPage.find({
      "services.monitor": monitorId,
    })
      .select("_id services")
      .lean();

    if (!statusPages || statusPages.length === 0) {
      return [];
    }

    const pageIds = statusPages.map((p) => p._id);
    const serviceIds = statusPages.flatMap((p) =>
      p.services
        .filter((s) => s.monitor?.toString() === monitorId.toString())
        .map((s) => s._id),
    );

    const filter = {
      statusPage: { $in: pageIds },
      status: { $in: ["scheduled", "in_progress", "completed"] },
      scheduledEnd: { $gte: windowStart },
      scheduledStart: { $lte: windowEnd },
    };

    if (serviceIds.length > 0) {
      filter.$or = [
        { affectedServices: { $exists: false } },
        { affectedServices: { $size: 0 } },
        { affectedServices: { $in: serviceIds } },
      ];
    }

    const records = await StatusMaintenance.find(filter)
      .select("scheduledStart scheduledEnd status title")
      .lean();

    return records || [];
  } catch (error) {
    logger.warn("Could not load maintenance records for SLO evaluation", {
      monitorId,
      error: error.message,
    });
    return [];
  }
}

/**
 * Evaluates an SLO over its configured rolling window, computes duration-weighted SLI,
 * and persists an immutable evaluation snapshot.
 *
 * @param {string|mongoose.Types.ObjectId} sloId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
export async function evaluateSlo(sloId, options = {}) {
  const {
    now = new Date(),
    token = null,
    persistSnapshot = true,
    skipNextEvaluationUpdate = false,
  } = options;

  const slo = await Slo.findById(sloId);
  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${sloId}`);
  }

  const monitor = await Monitor.findById(slo.monitor);
  if (!monitor) {
    throw ApiError.notFound(`Target monitor not found for SLO: ${sloId}`);
  }

  const windowEnd = now instanceof Date ? now : new Date(now);
  const windowDurationMs =
    SLO_ROLLING_WINDOW_MS[slo.rollingWindow] || 30 * 86400000;
  const windowStart = new Date(windowEnd.getTime() - windowDurationMs);

  // Retrieve owner's plan data retention
  let planRetentionDays = 365;
  try {
    const owner = await User.findById(slo.owner).select("plan").lean();
    if (owner?.plan) {
      planRetentionDays =
        getPlanDefinition(owner.plan)?.limits.dataRetentionDays || 30;
    }
  } catch {
    planRetentionDays = 30;
  }

  // Load relevant maintenance windows
  const maintenanceWindows = await getMonitorMaintenanceWindows(
    monitor._id,
    windowStart,
    windowEnd,
  );

  // Bounded, indexed HealthCheck query streaming cursor
  const queryStart = new Date(
    Math.max(
      windowStart.getTime(),
      monitor.createdAt ? new Date(monitor.createdAt).getTime() : 0,
      windowEnd.getTime() - planRetentionDays * 86400000,
    ),
  );

  const checksCursor = HealthCheck.find({
    monitor: monitor._id,
    checkedAt: { $gte: queryStart, $lte: windowEnd },
  })
    .select("status checkedAt intervalSeconds scheduled")
    .sort({ checkedAt: 1 })
    .lean()
    .cursor({ batchSize: 1000 });

  const result = await calculateSliFromChecks(checksCursor, {
    targetPercentage: slo.targetPercentage,
    rollingWindow: slo.rollingWindow,
    windowEnd,
    monitorCreatedAt: monitor.createdAt,
    planRetentionDays,
    monitorInterval: monitor.interval,
    maxIntervalAttributionSeconds:
      slo.measurementContract?.maxIntervalAttributionSeconds,
    minimumDataCoveragePercent:
      slo.measurementContract?.minimumDataCoveragePercent,
    excludeMaintenance: slo.measurementContract?.excludeMaintenance,
    countDegradedAsDown: slo.measurementContract?.countDegradedAsDown,
    maintenanceWindows,
    budgetWarningThresholdPercent:
      slo.alertSettings?.budgetWarningThresholdPercent || 20,
    burnRateThresholds: slo.alertSettings?.burnRateThresholds,
  });

  // Evaluate burn rates, budget thresholds, and alert transitions
  let alertProcessing = null;
  try {
    alertProcessing = await processSloAlerts({
      slo,
      evaluationResult: result,
      now: windowEnd,
      deps: options.deps,
    });
  } catch (alertErr) {
    logger.error("SLO alert processing encountered error", {
      sloId: slo._id,
      error: alertErr.message,
    });
  }

  let snapshot = null;
  const idempotencyKey = `${slo._id}:${windowEnd.toISOString()}`;

  if (persistSnapshot) {
    try {
      snapshot = await SloSnapshot.create({
        slo: slo._id,
        monitor: monitor._id,
        owner: slo.owner,
        evaluatedAt: windowEnd,
        windowStart: result.windowStart,
        windowEnd: result.windowEnd,
        effectiveWindowStart: result.effectiveWindowStart,
        calculationVersion: result.calculationVersion,
        targetPercentage: result.metadata.targetPercentage,
        rollingWindow: result.metadata.rollingWindow,
        sliPercentage: result.sliPercentage,
        status: result.status,
        goodDurationSeconds: result.goodDurationSeconds,
        badDurationSeconds: result.badDurationSeconds,
        unknownDurationSeconds: result.unknownDurationSeconds,
        maintenanceDurationSeconds: result.maintenanceDurationSeconds,
        observedDurationSeconds: result.observedDurationSeconds,
        totalWindowSeconds: result.totalWindowSeconds,
        effectiveWindowSeconds: result.effectiveWindowSeconds,
        eligibleWindowSeconds: result.eligibleWindowSeconds,
        coveragePercentage: result.coveragePercentage,
        allowedBudgetSeconds: result.allowedBudgetSeconds,
        consumedBudgetSeconds: result.consumedBudgetSeconds,
        remainingBudgetSeconds: result.remainingBudgetSeconds,
        remainingBudgetPercentage: result.remainingBudgetPercentage,
        budgetConsumptionPercentage: result.budgetConsumptionPercentage,
        sampleCount: result.sampleCount,
        goodChecks: result.goodChecks,
        badChecks: result.badChecks,
        degradedChecks: result.degradedChecks,
        unknownChecks: result.unknownChecks,
        burnRates: result.burnRates || [],
        exhaustionForecast: result.exhaustionForecast || null,
        alertEvents: alertProcessing?.alertEvents || [],
        metadata: result.metadata,
        idempotencyKey,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Idempotency: snapshot already persisted for this tick
        snapshot = await SloSnapshot.findOne({ idempotencyKey });
      } else {
        throw err;
      }
    }

    // Update Slo document with latest evaluation cache
    slo.lastEvaluatedAt = windowEnd;
    slo.lastSnapshot = snapshot?._id || null;
    slo.lastSliPercentage = result.sliPercentage;
    slo.lastStatus = result.status;
    slo.lastBudgetConsumptionPercentage = result.budgetConsumptionPercentage;
    slo.lastBurnRates = result.burnRates || [];
    slo.lastExhaustionForecast = result.exhaustionForecast || null;
    if (alertProcessing?.state?._id) {
      slo.alertState = alertProcessing.state._id;
    }

    if (!skipNextEvaluationUpdate) {
      const nextSeconds = slo.evaluationIntervalSeconds || 3600;
      slo.nextEvaluationAt = new Date(windowEnd.getTime() + nextSeconds * 1000);
    }

    if (token && slo.evaluationLeaseToken === token) {
      slo.evaluationLeaseToken = null;
      slo.evaluationLeaseUntil = null;
      slo.evaluationRetryAt = null;
    }

    await slo.save();
  }

  return {
    result,
    snapshot,
    alertState: alertProcessing?.state || null,
    alertEvents: alertProcessing?.alertEvents || [],
    triggeredConditions: alertProcessing?.triggeredConditions || [],
  };
}

export { getSloAlertState };

/**
 * Retrieves paginated historical evaluation snapshots for an SLO.
 */
export async function getSloSnapshots(
  sloId,
  { page = 1, limit = 20, startDate, endDate },
  user,
) {
  const slo = await Slo.findById(sloId);
  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${sloId}`);
  }

  const ownerId = resolveOwnerId(user);
  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  const filter = { slo: slo._id };
  if (startDate || endDate) {
    filter.evaluatedAt = {};
    if (startDate) filter.evaluatedAt.$gte = new Date(startDate);
    if (endDate) filter.evaluatedAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [snapshots, total] = await Promise.all([
    SloSnapshot.find(filter)
      .sort({ evaluatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SloSnapshot.countDocuments(filter),
  ]);

  return {
    snapshots,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Retrieves the most recent evaluation snapshot for an SLO.
 */
export async function getLatestSloSnapshot(sloId, user) {
  const slo = await Slo.findById(sloId);
  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${sloId}`);
  }

  const ownerId = resolveOwnerId(user);
  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  const snapshot = await SloSnapshot.findOne({ slo: slo._id })
    .sort({ evaluatedAt: -1 })
    .lean();

  return snapshot;
}

/**
 * Controlled backfill of historical evaluation snapshots for an SLO.
 */
export async function backfillSloEvaluations(
  sloId,
  { startDate, endDate, stepSeconds = 3600 },
  user,
) {
  const slo = await Slo.findById(sloId);
  if (!slo) {
    throw ApiError.notFound(`SLO not found with id: ${sloId}`);
  }

  const ownerId = resolveOwnerId(user);
  const isOwner = slo.owner.toString() === ownerId;
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  const tStart = new Date(startDate).getTime();
  const tEnd = new Date(endDate).getTime();
  const stepMs = Math.max(300, stepSeconds) * 1000;

  const snapshots = [];
  for (let t = tStart; t <= tEnd; t += stepMs) {
    const { snapshot } = await evaluateSlo(slo._id, {
      now: new Date(t),
      persistSnapshot: true,
      skipNextEvaluationUpdate: true,
    });
    if (snapshot) snapshots.push(snapshot);
  }

  return {
    backfilledCount: snapshots.length,
    startDate: new Date(tStart),
    endDate: new Date(tEnd),
  };
}
