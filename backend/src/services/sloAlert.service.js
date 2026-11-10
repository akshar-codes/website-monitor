import SloAlertState from "../models/SloAlertState.js";
import Notification from "../models/Notification.js";
import NotificationDelivery from "../models/NotificationDelivery.js";
import NotificationIntegration from "../models/NotificationIntegration.js";
import NotificationRule from "../models/NotificationRule.js";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_PRIORITIES,
} from "../config/notificationConstants.js";
import logger from "../utils/logger.js";
import ApiError from "../utils/ApiError.js";
import { ROLES } from "../config/constants.js";

const resolveOwnerId = (user) => (user.id || user._id).toString();

/**
 * Maps alert severities to notification priorities.
 */
const SEVERITY_TO_PRIORITY = {
  critical: NOTIFICATION_PRIORITIES.CRITICAL,
  high: NOTIFICATION_PRIORITIES.HIGH,
  normal: NOTIFICATION_PRIORITIES.NORMAL,
  low: NOTIFICATION_PRIORITIES.LOW,
};

/**
 * Pure function to evaluate which alert conditions are currently triggered
 * based on the evaluation result and SLO configuration.
 *
 * @param {Object} params
 * @param {Object} params.slo
 * @param {Object} params.evaluationResult
 * @param {Date} params.now
 * @returns {Array<Object>} List of triggered alert descriptors.
 */
export function evaluateAlertConditions({
  slo,
  evaluationResult,
  now = new Date(),
}) {
  const alertSettings = slo.alertSettings || {};
  const triggered = [];
  const evalDate = now instanceof Date ? now : new Date(now);

  const {
    burnRates = [],
    remainingBudgetSeconds = 0,
    remainingBudgetPercentage = 100,
    budgetConsumptionPercentage = 0,
    exhaustionForecast = null,
  } = evaluationResult;

  // 1. Burn Rate Alerts
  if (
    alertSettings.burnRateAlertsEnabled &&
    Array.isArray(alertSettings.burnRateThresholds)
  ) {
    for (const threshold of alertSettings.burnRateThresholds) {
      const metric = burnRates.find((b) => b.window === threshold.window);
      if (!metric) continue;

      // Require sufficient evidence to prevent false alerts from tiny denominators
      if (metric.hasSufficientEvidence && metric.burnRate >= threshold.rate) {
        triggered.push({
          alertType: "burn_rate",
          window: threshold.window,
          rate: metric.burnRate,
          thresholdRate: threshold.rate,
          severity: threshold.severity || "critical",
          message: `SLO "${slo.name}" burn rate in ${threshold.window} window is ${metric.burnRate}x (exceeds threshold ${threshold.rate}x). Remaining error budget: ${remainingBudgetSeconds}s (${remainingBudgetPercentage}%).`,
          forecast: exhaustionForecast,
          triggeredAt: evalDate,
        });
      }
    }
  }

  // 2. Error Budget Exhausted Alert
  if (
    alertSettings.budgetExhaustedAlert !== false &&
    (remainingBudgetSeconds <= 0 || budgetConsumptionPercentage >= 100)
  ) {
    triggered.push({
      alertType: "budget_exhausted",
      window: null,
      rate: null,
      thresholdRate: 100,
      severity: "critical",
      message: `SLO "${slo.name}" error budget is completely exhausted! 0 seconds remaining (${budgetConsumptionPercentage}% consumed).`,
      forecast: exhaustionForecast,
      triggeredAt: evalDate,
    });
  }
  // 3. Error Budget Warning Alert (if not already exhausted)
  else if (
    remainingBudgetPercentage <=
      (alertSettings.budgetWarningThresholdPercent || 20) &&
    remainingBudgetSeconds > 0
  ) {
    triggered.push({
      alertType: "budget_warning",
      window: null,
      rate: null,
      thresholdRate: alertSettings.budgetWarningThresholdPercent || 20,
      severity: "high",
      message: `SLO "${slo.name}" error budget is nearly depleted. Only ${remainingBudgetPercentage}% (${remainingBudgetSeconds}s) budget remaining.`,
      forecast: exhaustionForecast,
      triggeredAt: evalDate,
    });
  }

  return triggered;
}

/**
 * Dispatches in-app notifications and queues integration deliveries for an SLO alert event.
 * Isolated in its own execution boundary so errors never bubble up to invalidate evaluations.
 */
async function dispatchAlertNotifications({
  slo,
  alertEvent,
  isRecovery = false,
  deps = {},
}) {
  const NotificationModel = deps.Notification || Notification;
  const DeliveryModel = deps.NotificationDelivery || NotificationDelivery;
  const IntegrationModel =
    deps.NotificationIntegration || NotificationIntegration;
  const RuleModel = deps.NotificationRule || NotificationRule;

  const ownerId = String(slo.owner);
  const monitorId = String(slo.monitor);
  const sloId = String(slo._id);

  let type;
  let eventType;
  let title;
  let priority;

  if (isRecovery) {
    type = NOTIFICATION_TYPES.SLO_RECOVERED;
    eventType = "slo.recovered";
    title = `[Resolved] SLO "${slo.name}" has recovered`;
    priority = NOTIFICATION_PRIORITIES.NORMAL;
  } else if (alertEvent.alertType === "budget_exhausted") {
    type = NOTIFICATION_TYPES.SLO_BUDGET_EXHAUSTED;
    eventType = "slo.budget_exhausted";
    title = `[Critical] SLO "${slo.name}" Error Budget Exhausted`;
    priority = NOTIFICATION_PRIORITIES.CRITICAL;
  } else if (alertEvent.alertType === "budget_warning") {
    type = NOTIFICATION_TYPES.SLO_BUDGET_WARNING;
    eventType = "slo.budget_warning";
    title = `[Warning] SLO "${slo.name}" Error Budget Depleted`;
    priority = NOTIFICATION_PRIORITIES.HIGH;
  } else {
    type = NOTIFICATION_TYPES.SLO_BURN_RATE_ALERT;
    eventType = "slo.burn_rate";
    title = `[${(alertEvent.severity || "critical").toUpperCase()}] SLO "${slo.name}" Burn Rate Alert (${alertEvent.window})`;
    priority =
      SEVERITY_TO_PRIORITY[alertEvent.severity] ||
      NOTIFICATION_PRIORITIES.CRITICAL;
  }

  // 1. Create In-App Notification
  let createdNotification = null;
  try {
    createdNotification = await NotificationModel.create({
      owner: ownerId,
      type,
      category: NOTIFICATION_CATEGORIES.MONITOR,
      priority,
      title,
      message: alertEvent.message,
      link: `/slos/${sloId}`,
      dedupeKey: alertEvent.dedupeKey,
      relatedResource: {
        resourceType: "Monitor",
        resourceId: monitorId,
      },
      metadata: {
        sloId,
        monitorId,
        alertType: alertEvent.alertType,
        window: alertEvent.window,
        burnRate: alertEvent.rate,
        forecast: alertEvent.forecast,
      },
    });
  } catch (err) {
    logger.warn("In-app notification creation encountered error", {
      sloId,
      error: err.message,
    });
  }

  const eventId = createdNotification?._id
    ? String(createdNotification._id)
    : alertEvent.dedupeKey;

  // 2. Deliver to explicit SLO integrations and matching user notification rules
  try {
    const integrationIds = new Set(
      (slo.alertSettings?.integrationIds || []).map((id) => String(id)),
    );

    // Also include any rules listening for this event type
    const rules = await RuleModel.find({
      owner: ownerId,
      isActive: true,
      events: eventType,
    }).lean();

    for (const rule of rules) {
      if (
        rule.filters?.monitorIds?.length &&
        !rule.filters.monitorIds.some((mId) => String(mId) === monitorId)
      ) {
        continue;
      }
      for (const intId of rule.integrationIds || []) {
        integrationIds.add(String(intId));
      }
    }

    if (integrationIds.size > 0) {
      const activeIntegrations = await IntegrationModel.find({
        owner: ownerId,
        isActive: true,
        _id: { $in: Array.from(integrationIds) },
      }).lean();

      const deliveryPromises = activeIntegrations.map((integration) => {
        const intId = String(integration._id);
        const idempotencyKey = `${eventId}:${intId}:${eventType}`;
        const payload = {
          eventId,
          type: eventType,
          title,
          message: alertEvent.message,
          priority,
          monitorId,
          sloId,
          metadata: alertEvent,
          createdAt: new Date().toISOString(),
        };

        return DeliveryModel.updateOne(
          { idempotencyKey },
          {
            $setOnInsert: {
              owner: ownerId,
              integration: intId,
              eventId,
              eventType,
              idempotencyKey,
              payload,
              status: "pending",
              nextRetryAt: new Date(),
            },
          },
          { upsert: true },
        ).catch((deliveryErr) =>
          logger.warn("Integration delivery queue error", {
            intId,
            error: deliveryErr.message,
          }),
        );
      });

      await Promise.all(deliveryPromises);
    }
  } catch (integrationErr) {
    logger.warn("External integration queuing encountered error", {
      sloId,
      error: integrationErr.message,
    });
  }
}

/**
 * Processes SLO alert state transitions, deduplication, recovery detection,
 * and isolated notification dispatch.
 *
 * @param {Object} params
 * @param {Object} params.slo
 * @param {Object} params.evaluationResult
 * @param {Date} params.now
 * @param {Object} params.deps - Optional dependency injection for testing.
 * @returns {Promise<Object>} Processed alert state summary.
 */
export async function processSloAlerts({
  slo,
  evaluationResult,
  now = new Date(),
  deps = {},
}) {
  const StateModel = deps.SloAlertState || SloAlertState;
  const evalDate = now instanceof Date ? now : new Date(now);
  const cooldownMs =
    Math.max(5, Number(slo.alertSettings?.cooldownMinutes) || 60) * 60 * 1000;

  // 1. Fetch or initialize persistent alert state atomically
  const state = await StateModel.findOneAndUpdate(
    { slo: slo._id },
    {
      $setOnInsert: {
        slo: slo._id,
        monitor: slo.monitor,
        owner: slo.owner,
        status: "healthy",
        incidentSequence: 1,
        activeAlerts: [],
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  // 2. Evaluate currently triggered conditions
  const triggeredConditions = evaluateAlertConditions({
    slo,
    evaluationResult,
    now: evalDate,
  });

  const existingActiveAlerts = state.activeAlerts || [];
  const nextActiveAlerts = [];
  const alertEvents = [];
  const notificationErrors = [];

  const newAlerts = [];
  const resolvedAlerts = [];

  if (triggeredConditions.length > 0) {
    // ── Active Alert State ──
    state.consecutiveBreaches += 1;
    state.consecutiveRecoveries = 0;
    state.lastAlertAt = evalDate;

    // Determine aggregate state status
    if (triggeredConditions.some((a) => a.alertType === "budget_exhausted")) {
      state.status = "exhausted";
    } else if (triggeredConditions.some((a) => a.alertType === "burn_rate")) {
      state.status = "breached";
    } else {
      state.status = "warning";
    }

    for (const condition of triggeredConditions) {
      const matchIndex = existingActiveAlerts.findIndex(
        (a) =>
          a.alertType === condition.alertType &&
          String(a.window || "") === String(condition.window || ""),
      );

      const dedupeKey = `${slo._id}:${condition.alertType}:${condition.window || "global"}:${state.incidentSequence}`;

      if (matchIndex >= 0) {
        // Condition already active: Check cooldown for repeat notification
        const active = existingActiveAlerts[matchIndex];
        const timeSinceNotified =
          evalDate.getTime() - new Date(active.lastNotifiedAt).getTime();

        if (timeSinceNotified >= cooldownMs) {
          // Cooldown elapsed: send repeat reminder notification
          active.lastNotifiedAt = evalDate;
          active.rate = condition.rate;
          active.message = condition.message;
          nextActiveAlerts.push(active);

          const alertEvent = {
            ...condition,
            dedupeKey: `${dedupeKey}:repeat:${evalDate.getTime()}`,
          };
          alertEvents.push(alertEvent);

          try {
            await dispatchAlertNotifications({ slo, alertEvent, deps });
          } catch (err) {
            notificationErrors.push(err.message);
          }
        } else {
          // Deduplication: Still within cooldown, suppress notification!
          active.rate = condition.rate;
          active.message = condition.message;
          nextActiveAlerts.push(active);
        }
      } else {
        // New Alert Triggered!
        const alertRecord = {
          alertType: condition.alertType,
          window: condition.window,
          rate: condition.rate,
          thresholdRate: condition.thresholdRate,
          severity: condition.severity,
          triggeredAt: evalDate,
          lastNotifiedAt: evalDate,
          dedupeKey,
          message: condition.message,
        };
        nextActiveAlerts.push(alertRecord);
        newAlerts.push(alertRecord);
        alertEvents.push(alertRecord);

        try {
          await dispatchAlertNotifications({
            slo,
            alertEvent: alertRecord,
            deps,
          });
        } catch (err) {
          notificationErrors.push(err.message);
        }
      }
    }
  } else {
    // ── Healthy / No Triggered Conditions ──
    state.consecutiveRecoveries += 1;
    state.consecutiveBreaches = 0;

    // Check for Recovery Detection
    if (existingActiveAlerts.length > 0) {
      const recoveryEvent = {
        alertType: "recovery",
        message: `SLO "${slo.name}" has returned to healthy status. Error budget is safe and all burn rates are normal.`,
        dedupeKey: `${slo._id}:recovery:${state.incidentSequence}:${evalDate.getTime()}`,
        severity: "normal",
        triggeredAt: evalDate,
      };

      resolvedAlerts.push(recoveryEvent);
      alertEvents.push(recoveryEvent);

      try {
        await dispatchAlertNotifications({
          slo,
          alertEvent: recoveryEvent,
          isRecovery: true,
          deps,
        });
      } catch (err) {
        notificationErrors.push(err.message);
      }

      state.lastResolvedAt = evalDate;
      state.incidentSequence += 1; // Advance incident sequence so future alerts get fresh dedupe keys!
    }

    state.status = "healthy";
  }

  state.activeAlerts = nextActiveAlerts;
  state.lastEvaluatedAt = evalDate;
  state.lastBurnRates = evaluationResult.burnRates || [];
  state.lastExhaustionForecast = evaluationResult.exhaustionForecast || null;

  await state.save();

  return {
    state,
    triggeredConditions,
    newAlerts,
    resolvedAlerts,
    alertEvents,
    notificationErrors,
  };
}

/**
 * Retrieves the current SLO alert state for an SLO with ownership authorization.
 *
 * @param {string} sloId
 * @param {Object} user
 * @returns {Promise<Object>}
 */
export async function getSloAlertState(sloId, user) {
  const ownerId = resolveOwnerId(user);
  const state = await SloAlertState.findOne({ slo: sloId }).populate(
    "slo",
    "name targetPercentage rollingWindow",
  );

  if (!state) {
    throw ApiError.notFound(`SLO alert state not found for SLO: ${sloId}`);
  }

  const isOwner = String(state.owner) === String(ownerId);
  const isAdmin = user.role === ROLES.ADMIN;

  if (!isOwner && !isAdmin) {
    throw ApiError.forbidden(
      "You do not have permission to access this resource",
      "OWNERSHIP_REQUIRED",
    );
  }

  return state;
}
