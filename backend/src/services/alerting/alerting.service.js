import mongoose from "mongoose";
import AlertPolicy from "../../models/AlertPolicy.js";
import AlertAcknowledgement from "../../models/AlertAcknowledgement.js";
import AlertEscalationExecution from "../../models/AlertEscalationExecution.js";
import NotificationDelivery from "../../models/NotificationDelivery.js";
import NotificationIntegration from "../../models/NotificationIntegration.js";
import Notification from "../../models/Notification.js";
import NotificationRule from "../../models/NotificationRule.js";
import Incident from "../../models/Incident.js";
import Monitor from "../../models/Monitor.js";
import ApiError from "../../utils/ApiError.js";
import logger from "../../utils/logger.js";
import { deliverToProvider } from "../integrations/deliveryProvider.service.js";

const getOwner = (user) => user.id || user._id;
let alertingTimer = null;
let alertingRunning = false;
const TYPE_TO_EVENT = Object.freeze({
  monitor_down: ["monitor.down"],
  monitor_up: ["monitor.recovered"],
  monitor_degraded: ["monitor.degraded"],
  incident_opened: ["incident.created", "monitor.down"],
  incident_resolved: ["incident.resolved", "monitor.recovered"],
  incident_updated: ["incident.updated"],
  ssl_expiring_soon: ["ssl.expiring"],
  ssl_expired: ["ssl.expiring"],
  domain_expiring_soon: ["domain.expiring"],
  domain_expired: ["domain.expiring"],
  ssl_invalid: ["monitor.ssl_error"],
});
const stringifyId = (value) =>
  value == null ? null : String(value._id || value);

const getNotificationContext = async (notification) => {
  let incidentId =
    notification.relatedResource?.resourceType === "Incident"
      ? stringifyId(notification.relatedResource.resourceId)
      : null;
  let monitorId =
    notification.metadata?.monitorId ||
    (notification.relatedResource?.resourceType === "Monitor"
      ? stringifyId(notification.relatedResource.resourceId)
      : null);
  let incident = null;
  if (incidentId)
    incident = await Incident.findById(incidentId)
      .select("monitor severity status")
      .lean();
  if (incident?.monitor) monitorId = stringifyId(incident.monitor);
  return {
    incidentId,
    monitorId: monitorId ? String(monitorId) : null,
    severity: incident?.severity || notification.priority,
  };
};

const enqueue = async ({
  owner,
  integrationId,
  eventId,
  eventType,
  payload,
  suffix = "event",
}) => {
  const idempotencyKey = `${eventId}:${integrationId}:${eventType}:${suffix}`;
  return NotificationDelivery.updateOne(
    { idempotencyKey },
    {
      $setOnInsert: {
        owner,
        integration: integrationId,
        eventId,
        eventType,
        idempotencyKey,
        payload,
        status: "pending",
        nextRetryAt: new Date(),
      },
    },
    { upsert: true },
  );
};

export const enqueueNotificationAlert = async (notification) => {
  if (!notification?.owner || !notification?._id) return { queued: 0 };
  const eventTypes = TYPE_TO_EVENT[notification.type] || [];
  if (!eventTypes.length) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { alertingProcessedAt: new Date() } },
    );
    return { queued: 0 };
  }
  const owner = notification.owner._id || notification.owner;
  const context = await getNotificationContext(notification);
  const basePayload = {
    eventId: String(notification._id),
    title: notification.title,
    message: notification.message,
    priority: notification.priority || "normal",
    createdAt: notification.createdAt || new Date().toISOString(),
    link: notification.link || null,
    ...context,
  };
  const deliveries = [];
  for (const eventType of eventTypes) {
    const payload = { ...basePayload, type: eventType };
    const rules = await NotificationRule.find({
      owner,
      isActive: true,
      events: eventType,
    }).lean();
    const integrations = await NotificationIntegration.find({
      owner,
      isActive: true,
      _id: { $in: rules.flatMap((rule) => rule.integrationIds) },
    });
    const integrationsById = new Map(
      integrations.map((integration) => [String(integration._id), integration]),
    );
    for (const rule of rules) {
      if (
        rule.filters?.monitorIds?.length &&
        (!context.monitorId ||
          !rule.filters.monitorIds.some(
            (id) => String(id) === context.monitorId,
          ))
      )
        continue;
      if (
        rule.filters?.severity?.length &&
        !rule.filters.severity.includes(context.severity) &&
        !rule.filters.severity.includes(notification.priority)
      )
        continue;
      for (const id of rule.integrationIds) {
        if (integrationsById.has(String(id)))
          deliveries.push(
            enqueue({
              owner,
              integrationId: id,
              eventId: payload.eventId,
              eventType,
              payload,
            }),
          );
      }
    }
  }
  await Promise.all(deliveries);

  if (eventTypes.includes("incident.resolved") && context.incidentId) {
    await AlertEscalationExecution.updateMany(
      {
        incident: context.incidentId,
        owner,
        status: { $in: ["pending", "processing"] },
      },
      { $set: { status: "resolved", lockedUntil: null } },
    );
    await AlertAcknowledgement.deleteMany({
      incident: context.incidentId,
      owner,
    });
  } else if (
    (eventTypes.includes("incident.created") ||
      eventTypes.includes("monitor.down")) &&
    context.incidentId
  ) {
    const policies = await AlertPolicy.find({
      owner,
      isActive: true,
      triggerEvents: { $in: eventTypes },
    }).lean();
    for (const policy of policies) {
      const execution = await AlertEscalationExecution.findOneAndUpdate(
        { policy: policy._id, incident: context.incidentId },
        {
          $setOnInsert: {
            owner,
            policy: policy._id,
            incident: context.incidentId,
            eventId: basePayload.eventId,
            status: "pending",
            startedAt: new Date(),
            nextRunAt: new Date(
              Date.now() +
                (policy.escalationSteps?.[0]?.afterMinutes ||
                  policy.repeatPolicy?.intervalMinutes ||
                  1) *
                  60_000,
            ),
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      const payload = { ...basePayload, type: "incident.created" };
      for (const integrationId of policy.initialIntegrationIds || []) {
        await enqueue({
          owner,
          integrationId,
          eventId: payload.eventId,
          eventType: "incident.created",
          payload,
        });
      }
      if (!policy.escalationSteps?.length && !policy.repeatPolicy?.enabled) {
        execution.status = "completed";
        await execution.save();
      }
    }
  }
  await Notification.updateOne(
    { _id: notification._id },
    { $set: { alertingProcessedAt: new Date() } },
  );
  return { queued: deliveries.length };
};

const assertOwnedIntegrations = async (owner, ids) => {
  const unique = [...new Set(ids.map(String))];
  if (unique.some((id) => !mongoose.isValidObjectId(id)))
    throw ApiError.badRequest("An integration selection is invalid");
  const found = await NotificationIntegration.countDocuments({
    owner,
    _id: { $in: unique },
  });
  if (found !== unique.length)
    throw ApiError.badRequest("Select only integrations owned by your account");
};

const toRuleDto = (row) => row;
export const listNotificationRules = async (user) =>
  NotificationRule.find({ owner: getOwner(user) })
    .sort({ createdAt: -1 })
    .lean();
export const getNotificationRule = async (id, user) => {
  const row = await NotificationRule.findOne({
    _id: id,
    owner: getOwner(user),
  }).lean();
  if (!row) throw ApiError.notFound("Notification rule not found");
  return row;
};
export const createNotificationRule = async (data, user) => {
  const owner = getOwner(user);
  await assertOwnedIntegrations(owner, data.integrationIds);
  if (data.filters.monitorIds.length) {
    const owned = await Monitor.countDocuments({
      owner,
      _id: { $in: data.filters.monitorIds },
    });
    if (owned !== new Set(data.filters.monitorIds).size)
      throw ApiError.badRequest(
        "Rule filters may include only monitors you own",
      );
  }
  return toRuleDto(await NotificationRule.create({ ...data, owner }));
};
export const updateNotificationRule = async (id, data, user) => {
  const owner = getOwner(user);
  await assertOwnedIntegrations(owner, data.integrationIds || []);
  if (data.filters?.monitorIds?.length) {
    const owned = await Monitor.countDocuments({
      owner,
      _id: { $in: data.filters.monitorIds },
    });
    if (owned !== new Set(data.filters.monitorIds).size)
      throw ApiError.badRequest(
        "Rule filters may include only monitors you own",
      );
  }
  const row = await NotificationRule.findOneAndUpdate(
    { _id: id, owner },
    { $set: data },
    { returnDocument: "after", runValidators: true },
  );
  if (!row) throw ApiError.notFound("Notification rule not found");
  return row;
};
export const deleteNotificationRule = async (id, user) => {
  const row = await NotificationRule.findOneAndDelete({
    _id: id,
    owner: getOwner(user),
  });
  if (!row) throw ApiError.notFound("Notification rule not found");
  return { deleted: true };
};

const policyIntegrationIds = (data) => [
  ...(data.initialIntegrationIds || []),
  ...(data.escalationSteps || []).flatMap((step) => step.integrationIds || []),
  ...(data.repeatPolicy?.integrationIds || []),
];
export const listAlertPolicies = async (user) =>
  AlertPolicy.find({ owner: getOwner(user) })
    .sort({ createdAt: -1 })
    .lean();
export const getAlertPolicy = async (id, user) => {
  const row = await AlertPolicy.findOne({
    _id: id,
    owner: getOwner(user),
  }).lean();
  if (!row) throw ApiError.notFound("Alert policy not found");
  return row;
};
export const validateAlertPolicy = async (data, user) => {
  const ids = policyIntegrationIds(data);
  await assertOwnedIntegrations(getOwner(user), ids);
  const activeCount = await NotificationIntegration.countDocuments({
    owner: getOwner(user),
    isActive: true,
    _id: { $in: ids },
  });
  return {
    valid: activeCount === new Set(ids.map(String)).size,
    activeDestinations: activeCount,
  };
};
export const createAlertPolicy = async (data, user) => {
  await assertOwnedIntegrations(getOwner(user), policyIntegrationIds(data));
  return AlertPolicy.create({ ...data, owner: getOwner(user) });
};
export const updateAlertPolicy = async (id, data, user) => {
  await assertOwnedIntegrations(getOwner(user), policyIntegrationIds(data));
  const row = await AlertPolicy.findOneAndUpdate(
    { _id: id, owner: getOwner(user) },
    { $set: data },
    { returnDocument: "after", runValidators: true },
  );
  if (!row) throw ApiError.notFound("Alert policy not found");
  return row;
};
export const deleteAlertPolicy = async (id, user) => {
  const row = await AlertPolicy.findOneAndDelete({
    _id: id,
    owner: getOwner(user),
  });
  if (!row) throw ApiError.notFound("Alert policy not found");
  await AlertEscalationExecution.updateMany(
    {
      policy: id,
      owner: getOwner(user),
      status: { $in: ["pending", "processing"] },
    },
    { $set: { status: "cancelled", lockedUntil: null } },
  );
  return { deleted: true };
};

export const listDeliveries = async (
  user,
  { page = 1, limit = 25, status, provider, startDate, endDate } = {},
) => {
  const filter = { owner: getOwner(user) };
  if (status) filter.status = status;
  if (startDate || endDate)
    filter.createdAt = {
      ...(startDate ? { $gte: startDate } : {}),
      ...(endDate ? { $lte: endDate } : {}),
    };
  const ids = provider
    ? (
        await NotificationIntegration.find({ owner: getOwner(user), provider })
          .select("_id")
          .lean()
      ).map((row) => row._id)
    : null;
  if (ids) filter.integration = { $in: ids };
  const [deliveries, total] = await Promise.all([
    NotificationDelivery.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("integration", "name provider")
      .lean(),
    NotificationDelivery.countDocuments(filter),
  ]);
  return { deliveries, total, page, limit };
};
export const retryDelivery = async (id, user) => {
  const row = await NotificationDelivery.findOneAndUpdate(
    {
      _id: id,
      owner: getOwner(user),
      status: { $in: ["failed", "dead_letter"] },
    },
    {
      $set: {
        status: "pending",
        attempts: 0,
        nextRetryAt: new Date(),
        lockedUntil: null,
        error: null,
      },
    },
    { returnDocument: "after" },
  );
  if (!row) throw ApiError.notFound("Retryable delivery not found");
  return row;
};

export const acknowledgeIncident = async (id, user) => {
  const owner = getOwner(user);
  const incident = await Incident.findById(id)
    .populate("monitor", "owner")
    .lean();
  if (!incident || String(incident.monitor?.owner) !== String(owner))
    throw ApiError.notFound("Incident not found");
  if (incident.status === "resolved")
    throw ApiError.badRequest("Resolved incidents cannot be acknowledged");
  const acknowledgement = await AlertAcknowledgement.findOneAndUpdate(
    { owner, incident: id },
    {
      $setOnInsert: {
        owner,
        incident: id,
        acknowledgedBy: owner,
        acknowledgedAt: new Date(),
        source: "dashboard",
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  await AlertEscalationExecution.updateMany(
    { owner, incident: id, status: { $in: ["pending", "processing"] } },
    { $set: { status: "acknowledged", lockedUntil: null } },
  );
  return acknowledgement;
};
export const removeIncidentAcknowledgement = async (id, user) => {
  const owner = getOwner(user);
  const incident = await Incident.findById(id)
    .populate("monitor", "owner")
    .lean();
  if (!incident || String(incident.monitor?.owner) !== String(owner))
    throw ApiError.notFound("Incident not found");
  await AlertAcknowledgement.deleteOne({ owner, incident: id });
  await AlertEscalationExecution.updateMany(
    { owner, incident: id, status: "acknowledged" },
    { $set: { status: "pending", nextRunAt: new Date(Date.now() + 60_000) } },
  );
  return { acknowledged: false };
};
export const getIncidentEscalations = async (id, user) => {
  const owner = getOwner(user);
  const incident = await Incident.findById(id)
    .populate("monitor", "owner")
    .lean();
  if (!incident || String(incident.monitor?.owner) !== String(owner))
    throw ApiError.notFound("Incident not found");
  const [acknowledgement, executions] = await Promise.all([
    AlertAcknowledgement.findOne({ owner, incident: id })
      .populate("acknowledgedBy", "name")
      .lean(),
    AlertEscalationExecution.find({ owner, incident: id })
      .populate("policy", "name")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return { acknowledgement, executions };
};

const safeError = (error) => {
  if (error?.status) return `Provider returned HTTP ${error.status}`;
  if (/restricted network/i.test(error?.message || ""))
    return "Destination resolves to a restricted network address";
  if (/encryption|credential/i.test(error?.message || ""))
    return "Integration credentials could not be read";
  return "Delivery failed due to a network or provider error";
};

export const processNotificationDeliveryBatch = async ({
  batchSize = 40,
  now = new Date(),
} = {}) => {
  let delivered = 0;
  let failed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const row = await NotificationDelivery.findOneAndUpdate(
      {
        $or: [
          {
            status: { $in: ["pending", "failed"] },
            nextRetryAt: { $lte: now },
          },
          { status: "processing", lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "processing",
          lockedUntil: new Date(now.getTime() + 30_000),
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { nextRetryAt: 1, createdAt: 1 }, returnDocument: "after" },
    );
    if (!row) break;
    const integration = await NotificationIntegration.findOne({
      _id: row.integration,
      owner: row.owner,
      isActive: true,
    }).select("+credentials");
    if (!integration) {
      await NotificationDelivery.updateOne(
        { _id: row._id, status: "processing" },
        { $set: { status: "cancelled", lockedUntil: null } },
      );
      continue;
    }
    try {
      await deliverToProvider(integration, row.payload);
      await NotificationDelivery.updateOne(
        { _id: row._id, status: "processing" },
        {
          $set: {
            status: "delivered",
            deliveredAt: now,
            lockedUntil: null,
            error: null,
          },
        },
      );
      await NotificationIntegration.updateOne(
        { _id: integration._id },
        { $set: { lastSuccessAt: now, lastError: null } },
      );
      delivered += 1;
    } catch (error) {
      const permanent =
        (error.status >= 300 && error.status < 500 && error.status !== 429) ||
        /restricted network|invalid|credential/i.test(error.message || "");
      const dead = permanent || row.attempts >= 8;
      const delay =
        error.retryAfterMs ||
        Math.min(3_600_000, 5_000 * 2 ** Math.min(row.attempts - 1, 9));
      await NotificationDelivery.updateOne(
        { _id: row._id, status: "processing" },
        {
          $set: {
            status: dead ? "dead_letter" : "failed",
            nextRetryAt: new Date(now.getTime() + delay),
            lockedUntil: null,
            error: safeError(error),
            responseStatus: error.status || null,
          },
        },
      );
      await NotificationIntegration.updateOne(
        { _id: integration._id },
        { $set: { lastError: safeError(error) } },
      );
      failed += 1;
    }
  }
  return { delivered, failed };
};

export const processAlertEventBatch = async ({ batchSize = 50 } = {}) => {
  const types = Object.keys(TYPE_TO_EVENT);
  const events = await Notification.find({
    type: { $in: types },
    alertingProcessedAt: null,
  })
    .sort({ createdAt: 1 })
    .limit(batchSize);
  let processed = 0;
  for (const notification of events) {
    try {
      await enqueueNotificationAlert(notification);
      processed += 1;
    } catch {
      // Leave the source notification unprocessed; the next worker pass retries it.
    }
  }
  return { processed };
};

export const processEscalationBatch = async ({
  batchSize = 40,
  now = new Date(),
} = {}) => {
  let processed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const execution = await AlertEscalationExecution.findOneAndUpdate(
      {
        $or: [
          {
            status: "pending",
            nextRunAt: { $lte: now },
            $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }],
          },
          { status: "processing", lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "processing",
          lockedUntil: new Date(now.getTime() + 30_000),
        },
      },
      { sort: { nextRunAt: 1 }, returnDocument: "after" },
    );
    if (!execution) break;
    const [policy, incident, acknowledgement] = await Promise.all([
      AlertPolicy.findOne({
        _id: execution.policy,
        owner: execution.owner,
        isActive: true,
      }).lean(),
      Incident.findById(execution.incident)
        .populate("monitor", "owner name url")
        .lean(),
      AlertAcknowledgement.findOne({
        owner: execution.owner,
        incident: execution.incident,
      }).lean(),
    ]);
    if (acknowledgement || !incident || incident.status === "resolved") {
      execution.status = acknowledgement ? "acknowledged" : "resolved";
      execution.lockedUntil = null;
      await execution.save();
      continue;
    }
    if (
      !policy ||
      String(incident.monitor?.owner) !== String(execution.owner)
    ) {
      execution.status = "cancelled";
      execution.lockedUntil = null;
      await execution.save();
      continue;
    }
    let integrationIds = [];
    let priority = "high";
    let nextRunAt = null;
    if (execution.currentStep < policy.escalationSteps.length) {
      const step = policy.escalationSteps[execution.currentStep];
      integrationIds = step.integrationIds || [];
      priority = step.priority || "high";
      const nextStep = policy.escalationSteps[execution.currentStep + 1];
      if (nextStep)
        nextRunAt = new Date(
          execution.startedAt.getTime() + nextStep.afterMinutes * 60_000,
        );
      else if (
        policy.repeatPolicy?.enabled &&
        policy.repeatPolicy.maxRepeats > 0
      )
        nextRunAt = new Date(
          now.getTime() + policy.repeatPolicy.intervalMinutes * 60_000,
        );
      execution.currentStep += 1;
    } else if (
      policy.repeatPolicy?.enabled &&
      execution.repeatCount < policy.repeatPolicy.maxRepeats
    ) {
      integrationIds = policy.repeatPolicy.integrationIds?.length
        ? policy.repeatPolicy.integrationIds
        : policy.initialIntegrationIds;
      priority = "high";
      execution.repeatCount += 1;
      nextRunAt = new Date(
        now.getTime() + policy.repeatPolicy.intervalMinutes * 60_000,
      );
    }
    const activeIntegrations = await NotificationIntegration.find({
      owner: execution.owner,
      isActive: true,
      _id: { $in: integrationIds },
    })
      .select("_id")
      .lean();
    const payload = {
      eventId: String(execution.eventId),
      type: "incident.created",
      title: `Escalation: ${incident.monitor?.name || "Monitor incident"}`,
      message: `Incident ${execution.incident} remains unresolved and unacknowledged.`,
      priority,
      incidentId: String(execution.incident),
      monitorId: String(incident.monitor?._id),
      severity: incident.severity,
      link: `/incidents`,
      createdAt: now.toISOString(),
    };
    for (const integration of activeIntegrations)
      await enqueue({
        owner: execution.owner,
        integrationId: integration._id,
        eventId: `${execution.eventId}:escalation:${execution.currentStep}:${execution.repeatCount}`,
        eventType: "incident.created",
        payload,
      });
    execution.status = nextRunAt ? "pending" : "completed";
    execution.nextRunAt = nextRunAt || execution.nextRunAt;
    execution.lockedUntil = null;
    await execution.save();
    processed += 1;
  }
  return { processed };
};

export const startAlertingWorker = () => {
  if (alertingTimer) return;
  alertingTimer = setInterval(() => {
    if (alertingRunning) return;
    alertingRunning = true;
    void (async () => {
      await processAlertEventBatch();
      await processNotificationDeliveryBatch();
      await processEscalationBatch();
    })()
      .catch((error) =>
        logger.error("Alerting worker failed", { error: error.message }),
      )
      .finally(() => {
        alertingRunning = false;
      });
  }, 2_000);
  alertingTimer.unref?.();
};
export const stopAlertingWorker = async () => {
  if (alertingTimer) clearInterval(alertingTimer);
  alertingTimer = null;
  while (alertingRunning)
    await new Promise((resolve) => setTimeout(resolve, 25));
};
