import { randomUUID } from "node:crypto";
import RegionalProbeRun from "../models/RegionalProbeRun.js";
import RegionalCheck from "../models/RegionalCheck.js";
import ProbeAgent from "../models/ProbeAgent.js";
import RegionalIncident from "../models/RegionalIncident.js";
import RegionalDailyStat from "../models/RegionalDailyStat.js";
import RegionalHourlyStat from "../models/RegionalHourlyStat.js";
import RegionalPerformanceState from "../models/RegionalPerformanceState.js";
import Monitor from "../models/Monitor.js";
import HealthCheck from "../models/HealthCheck.js";
import { createNotification } from "./notification.service.js";
import { handleIncident } from "../workers/incidentManager.js";
import { updateDailyStat } from "../workers/aggregationManager.js";
import { getPlanDefinition } from "../config/plans.js";
import { PROBE_REGIONS, getRegion } from "../config/regions.js";
import { HEALTH_STATUS, FAILURE_REASONS } from "../config/constants.js";
import { latencyBucketKey } from "../utils/latencyHistogram.js";

const AGENT_ONLINE_MS = 90_000;
const JOB_LEASE_MS = 45_000;
const MAX_JOB_ATTEMPTS = 5;
const REGIONAL_FAILURE_THRESHOLD = 2;
const REGIONAL_RECOVERY_THRESHOLD = 2;
const DATE_BUCKETS = Object.freeze({ hourly: 3_600_000, daily: 86_400_000 });
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
const mad = (values) => {
  const center = median(values);
  return center == null
    ? null
    : median(values.map((value) => Math.abs(value - center)));
};

export const evaluateRegionalPerformance = async (check, deps = {}) => {
  if (
    check.healthStatus === HEALTH_STATUS.DOWN ||
    check.healthStatus === HEALTH_STATUS.UNKNOWN ||
    check.httpStatus == null ||
    !Number.isFinite(check.responseTime)
  )
    return null;
  const State = deps.RegionalPerformanceState || RegionalPerformanceState;
  const Checks = deps.RegionalCheck || RegionalCheck;
  const state = await State.findOneAndUpdate(
    { monitor: check.monitor, regionId: check.regionId },
    {
      $setOnInsert: {
        monitor: check.monitor,
        regionId: check.regionId,
        status: "normal",
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  if (String(state.lastEvaluatedCheck || "") === String(check._id))
    return state;
  let baseline = [...(state.baselineSamples || [])];
  if (!baseline.length) {
    const prior = await Checks.find({
      monitor: check.monitor,
      regionId: check.regionId,
      jobStatus: "complete",
      httpStatus: { $ne: null },
      _id: { $ne: check._id },
      completedAt: { $lt: check.completedAt },
    })
      .sort({ completedAt: -1 })
      .limit(19)
      .select("responseTime")
      .lean();
    baseline = prior
      .reverse()
      .map((row) => row.responseTime)
      .filter(Number.isFinite);
  }
  const warming = baseline.length < 20;
  if (warming) baseline = [...baseline, check.responseTime].slice(-50);
  state.baselineSamples = baseline;
  state.recentSamples = [
    ...(state.recentSamples || []),
    check.responseTime,
  ].slice(-5);
  state.lastEvaluatedCheck = check._id;
  state.baselineMedianMs = median(baseline);
  state.baselineMadMs = mad(baseline);
  if (baseline.length < 20) {
    await state.save();
    return state;
  }
  const current = median(state.recentSamples);
  const center = state.baselineMedianMs;
  const deviation = state.baselineMadMs || 0;
  const threshold = Math.max(center * 1.5, center + 3 * deviation, center + 50);
  const recovery = center + Math.max(center * 0.25, deviation * 2, 25);
  if (state.status === "normal") {
    const breached = current >= threshold;
    state.consecutiveBreaches = breached ? state.consecutiveBreaches + 1 : 0;
    if (!breached && !warming) {
      baseline = [...baseline, check.responseTime].slice(-50);
      state.baselineSamples = baseline;
      state.baselineMedianMs = median(baseline);
      state.baselineMadMs = mad(baseline);
    }
    if (state.consecutiveBreaches >= 3) {
      state.status = "degraded";
      state.lastAlertAt = new Date();
      const monitor = await (deps.Monitor || Monitor)
        .findById(check.monitor)
        .select("owner name")
        .lean();
      await (deps.createNotification || createNotification)({
        ownerId: monitor.owner,
        type: "regional_performance_degraded",
        title: `${getRegion(check.regionId).name} response time degraded`,
        message: `${monitor.name} has sustained elevated latency from ${getRegion(check.regionId).location}. Baseline ${Math.round(center)} ms; current median ${Math.round(current)} ms.`,
        priority: "high",
        link: `/monitors/${monitor._id}`,
        relatedResource: { resourceType: "Monitor", resourceId: monitor._id },
        dedupeKey: `${monitor._id}:${check.regionId}:performance:${check._id}`,
      });
    }
  } else {
    state.consecutiveRecoveries =
      current <= recovery ? state.consecutiveRecoveries + 1 : 0;
    if (state.consecutiveRecoveries >= 3) {
      state.status = "normal";
      state.consecutiveRecoveries = 0;
      state.consecutiveBreaches = 0;
      state.baselineSamples = [
        ...baseline,
        ...state.recentSamples.filter((value) => value <= recovery),
      ].slice(-50);
      state.baselineMedianMs = median(state.baselineSamples);
      state.baselineMadMs = mad(state.baselineSamples);
    }
  }
  await state.save();
  return state;
};

export const getRegionsForUser = async (user, deps = {}) => {
  const Agents = deps.ProbeAgent || ProbeAgent;
  const now = deps.now || new Date();
  const active = await Agents.find({
    lastHeartbeatAt: { $gte: new Date(now.getTime() - AGENT_ONLINE_MS) },
  })
    .select("regionId lastHeartbeatAt version")
    .lean();
  const byRegion = new Map(active.map((agent) => [agent.regionId, agent]));
  const definition = getPlanDefinition(user.plan);
  return {
    regions: PROBE_REGIONS.map((region) => {
      const agent = byRegion.get(region.id);
      return {
        ...region,
        operational: Boolean(agent),
        lastHeartbeatAt: agent?.lastHeartbeatAt || null,
        agentVersion: agent?.version || null,
      };
    }),
    limits: {
      maxRegionsPerMonitor: definition?.limits.maxRegionsPerMonitor ?? 0,
      regionalChecksPerDay: definition?.limits.regionalChecksPerDay ?? null,
    },
  };
};

export const recordAgentHeartbeat = async (agent, version, deps = {}) => {
  const Agents = deps.ProbeAgent || ProbeAgent;
  if (!getRegion(agent.regionId))
    throw new Error("Agent is configured for an unknown region");
  return Agents.findOneAndUpdate(
    { agentId: agent.agentId },
    {
      $set: {
        regionId: agent.regionId,
        lastHeartbeatAt: deps.now || new Date(),
        status: "active",
        version: version || null,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
};

export const createRegionalProbeRun = async (
  monitor,
  scheduledAt = new Date(),
  deps = {},
) => {
  const Runs = deps.RegionalProbeRun || RegionalProbeRun;
  const Checks = deps.RegionalCheck || RegionalCheck;
  const regions = monitor.regionalMonitoring?.regions || [];
  if (!monitor.regionalMonitoring?.enabled || !regions.length) return null;
  const runId = deps.runId || randomUUID();
  const deadlineAt = new Date(
    scheduledAt.getTime() +
      Math.min(30_000, Math.max(10_000, monitor.interval * 700)),
  );
  const run = await Runs.create({
    monitor: monitor._id,
    runId,
    expectedRegions: regions,
    intervalSeconds: monitor.interval,
    scheduledAt,
    deadlineAt,
  });
  await Checks.insertMany(
    regions.map((regionId) => ({ monitor: monitor._id, runId, regionId })),
  );
  return run;
};

export const claimRegionalProbe = async (agent, deps = {}) => {
  const Checks = deps.RegionalCheck || RegionalCheck;
  const Agents = deps.ProbeAgent || ProbeAgent;
  const now = deps.now || new Date();
  const alive = await Agents.exists({
    agentId: agent.agentId,
    regionId: agent.regionId,
    lastHeartbeatAt: { $gte: new Date(now.getTime() - AGENT_ONLINE_MS) },
  });
  if (!alive) return null;
  const leaseToken = deps.leaseToken || randomUUID();
  const job = await Checks.findOneAndUpdate(
    {
      regionId: agent.regionId,
      attempts: { $lt: MAX_JOB_ATTEMPTS },
      $or: [
        { jobStatus: "queued" },
        { jobStatus: "leased", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        jobStatus: "leased",
        leaseAgentId: agent.agentId,
        leaseToken,
        leaseUntil: new Date(now.getTime() + JOB_LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, returnDocument: "after", select: "+leaseToken" },
  );
  if (!job) return null;
  const run = await (deps.RegionalProbeRun || RegionalProbeRun)
    .findOne({ runId: job.runId, status: "pending" })
    .lean();
  if (!run) return null;
  const monitor = await (deps.Monitor || Monitor)
    .findById(job.monitor)
    .select("url interval")
    .lean();
  if (!monitor) return null;
  return {
    id: String(job._id),
    runId: job.runId,
    regionId: job.regionId,
    url: monitor.url,
    interval: monitor.interval,
    leaseToken: job.leaseToken,
    leaseUntil: job.leaseUntil,
  };
};

const updateRegionalStatistics = async (check, deps = {}) => {
  const at = new Date(check.completedAt);
  for (const [granularity, Model] of [
    ["hourly", deps.RegionalHourlyStat || RegionalHourlyStat],
    ["daily", deps.RegionalDailyStat || RegionalDailyStat],
  ]) {
    const date = new Date(
      Math.floor(at.getTime() / DATE_BUCKETS[granularity]) *
        DATE_BUCKETS[granularity],
    );
    const increment = {
      totalChecks: 1,
      ...(check.healthStatus === HEALTH_STATUS.UP
        ? { successfulChecks: 1 }
        : {}),
      ...(check.healthStatus === HEALTH_STATUS.DOWN ? { failedChecks: 1 } : {}),
      ...(check.healthStatus === HEALTH_STATUS.DEGRADED
        ? { degradedChecks: 1 }
        : {}),
    };
    const measurements = {
      ...(check.httpStatus != null && Number.isFinite(check.responseTime)
        ? { responseTime: check.responseTime }
        : {}),
      dnsMs: check.timings?.dnsMs,
      tcpConnectMs: check.timings?.tcpConnectMs,
      tlsHandshakeMs: check.timings?.tlsHandshakeMs,
      ttfbMs: check.timings?.ttfbMs,
    };
    for (const [metric, value] of Object.entries(measurements)) {
      if (!Number.isFinite(value) || value < 0) continue;
      const bucket = latencyBucketKey(value);
      increment[`latencyHistograms.${metric}.sampleCount`] = 1;
      increment[`latencyHistograms.${metric}.buckets.${bucket}`] = 1;
      if (metric === "responseTime") {
        increment.responseTimeSum = value;
        increment.responseTimeCount = 1;
      }
    }
    try {
      await Model.updateOne(
        {
          monitor: check.monitor,
          regionId: check.regionId,
          date,
          appliedRunIds: { $ne: check.runId },
        },
        {
          $setOnInsert: {
            monitor: check.monitor,
            regionId: check.regionId,
            date,
            "latencyHistograms.version": 2,
          },
          $addToSet: { appliedRunIds: check.runId },
          $inc: increment,
        },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
};

const updateRegionalIncident = async (check, deps = {}) => {
  const Incidents = deps.RegionalIncident || RegionalIncident;
  const PerformanceStates =
    deps.RegionalPerformanceState || RegionalPerformanceState;
  const active = await Incidents.findOne({
    monitor: check.monitor,
    regionId: check.regionId,
    status: { $in: ["confirming", "ongoing"] },
  }).sort({ startedAt: -1 });
  if (check.healthStatus === HEALTH_STATUS.UNKNOWN) return;
  if (check.healthStatus === HEALTH_STATUS.DEGRADED) {
    if (active) {
      active.consecutiveSuccesses = 0;
      active.lastCheck = check._id;
      await active.save();
    }
    return;
  }
  if (check.healthStatus === HEALTH_STATUS.DOWN) {
    if (!active) {
      await Incidents.create({
        monitor: check.monitor,
        regionId: check.regionId,
        status: "confirming",
        consecutiveFailures: 1,
        startedAt: check.checkedAt,
        lastCheck: check._id,
      });
      return;
    }
    active.consecutiveFailures += 1;
    active.consecutiveSuccesses = 0;
    active.lastCheck = check._id;
    if (
      active.status === "confirming" &&
      active.consecutiveFailures >= REGIONAL_FAILURE_THRESHOLD
    ) {
      active.status = "ongoing";
      await active.save();
      const monitor = await (deps.Monitor || Monitor)
        .findById(check.monitor)
        .select("name owner")
        .lean();
      await (deps.createNotification || createNotification)({
        ownerId: monitor.owner,
        type: "regional_outage",
        title: `${monitor.name} is unreachable from ${getRegion(check.regionId).location}`,
        message: `The monitored endpoint failed repeatedly from ${getRegion(check.regionId).name}.`,
        priority: "high",
        link: `/monitors/${monitor._id}`,
        relatedResource: {
          resourceType: "RegionalIncident",
          resourceId: active._id,
        },
        dedupeKey: `${active._id}:regional_outage`,
      });
      return;
    }
    await active.save();
    return;
  }
  if (active) {
    active.consecutiveSuccesses += 1;
    active.consecutiveFailures = 0;
    active.lastCheck = check._id;
    if (active.consecutiveSuccesses >= REGIONAL_RECOVERY_THRESHOLD) {
      const wasOpen = active.status === "ongoing";
      active.status = "resolved";
      active.recoveredAt = check.checkedAt;
      await active.save();
      if (wasOpen) {
        const monitor = await (deps.Monitor || Monitor)
          .findById(check.monitor)
          .select("name owner")
          .lean();
        await (deps.createNotification || createNotification)({
          ownerId: monitor.owner,
          type: "regional_recovered",
          title: `${monitor.name} recovered in ${getRegion(check.regionId).location}`,
          message: `The monitored endpoint is responding again from ${getRegion(check.regionId).name}.`,
          priority: "normal",
          link: `/monitors/${monitor._id}`,
          relatedResource: {
            resourceType: "RegionalIncident",
            resourceId: active._id,
          },
          dedupeKey: `${active._id}:regional_recovered`,
        });
      }
    } else await active.save();
  }
};

export const aggregateRegionalResults = (run, checks) => {
  const valid = checks.filter((check) =>
    [HEALTH_STATUS.UP, HEALTH_STATUS.DOWN, HEALTH_STATUS.DEGRADED].includes(
      check.healthStatus,
    ),
  );
  const quorum = Math.floor(run.expectedRegions.length / 2) + 1;
  let status = HEALTH_STATUS.UNKNOWN;
  if (valid.length >= quorum) {
    const downCount = valid.filter(
      (check) => check.healthStatus === HEALTH_STATUS.DOWN,
    ).length;
    const degradedCount = valid.filter(
      (check) => check.healthStatus === HEALTH_STATUS.DEGRADED,
    ).length;
    status =
      downCount >= quorum
        ? HEALTH_STATUS.DOWN
        : downCount || degradedCount
          ? HEALTH_STATUS.DEGRADED
          : HEALTH_STATUS.UP;
  }
  const httpChecks = valid.filter(
    (check) => check.httpStatus != null && Number.isFinite(check.responseTime),
  );
  const timingValues = (field) =>
    checks.map((check) => check.timings?.[field]).filter(Number.isFinite);
  const avg = (values) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  const httpStatuses = httpChecks
    .map((check) => check.httpStatus)
    .sort((a, b) => a - b);
  return {
    status,
    responseTime: median(httpChecks.map((check) => check.responseTime)),
    httpStatus: httpStatuses.length
      ? httpStatuses[Math.floor(httpStatuses.length / 2)]
      : null,
    failureReason:
      status === HEALTH_STATUS.UNKNOWN
        ? FAILURE_REASONS.INSUFFICIENT_HEALTH_DATA
        : null,
    timings: Object.fromEntries(
      [
        "dnsMs",
        "tcpConnectMs",
        "tlsHandshakeMs",
        "ttfbMs",
        "downloadMs",
        "totalMs",
      ].map((field) => [field, avg(timingValues(field))]),
    ),
    coverage: {
      observed: valid.length,
      expected: run.expectedRegions.length,
      quorum,
    },
  };
};

export const finalizeRegionalRun = async (runId, deps = {}) => {
  const Runs = deps.RegionalProbeRun || RegionalProbeRun;
  const Checks = deps.RegionalCheck || RegionalCheck;
  const now = deps.now || new Date();
  const run = await Runs.findOne({
    runId,
    $or: [
      { status: "pending" },
      {
        status: "finalizing",
        finalizingAt: { $lte: new Date(now.getTime() - 60_000) },
      },
    ],
  }).lean();
  if (!run) return null;
  const checks = await Checks.find({ runId }).lean();
  const allCompleted =
    checks.length === run.expectedRegions.length &&
    checks.every((check) => check.jobStatus === "complete");
  if (!allCompleted && now < new Date(run.deadlineAt)) return null;
  const claimed = await Runs.findOneAndUpdate(
    {
      _id: run._id,
      $or: [
        { status: "pending" },
        {
          status: "finalizing",
          finalizingAt: { $lte: new Date(now.getTime() - 60_000) },
        },
      ],
    },
    { $set: { status: "finalizing", finalizingAt: now } },
    { returnDocument: "after" },
  );
  if (!claimed) return null;
  const result = aggregateRegionalResults(run, checks);
  const timingValues = Object.values(result.timings);
  const aggregateCheck = await (
    deps.HealthCheck || HealthCheck
  ).findOneAndUpdate(
    { executionKey: `regional:${runId}` },
    {
      $setOnInsert: {
        executionKey: `regional:${runId}`,
        regionalRunId: runId,
        monitor: run.monitor,
        status: result.status,
        frontendStatus: result.status,
        backendStatus: result.status,
        databaseStatus: result.status,
        responseTime: result.responseTime ?? 0,
        timings: Object.fromEntries(
          Object.keys(result.timings).map((key, index) => [
            key,
            timingValues[index],
          ]),
        ),
        intervalSeconds: run.intervalSeconds,
        scheduled: true,
        httpStatus: result.httpStatus,
        failureReason: result.failureReason,
        checkedAt: run.scheduledAt,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  await (deps.RegionalCheck || RegionalCheck).updateMany(
    { runId, jobStatus: { $ne: "complete" } },
    { $set: { jobStatus: "expired" } },
  );
  const unaggregated = await (deps.RegionalCheck || RegionalCheck)
    .find({
      runId,
      jobStatus: "complete",
      aggregatedAt: null,
    })
    .lean();
  for (const check of unaggregated) {
    await updateRegionalStatistics(check, deps);
    await (deps.RegionalCheck || RegionalCheck).updateOne(
      { _id: check._id, aggregatedAt: null },
      { $set: { aggregatedAt: now } },
    );
  }
  const monitor = await (deps.Monitor || Monitor).findById(run.monitor).lean();
  if (monitor) {
    if (
      result.status === HEALTH_STATUS.UP ||
      result.status === HEALTH_STATUS.DOWN
    ) {
      const notifier = deps.createNotification || createNotification;
      await (deps.handleIncident || handleIncident)(monitor, aggregateCheck, {
        createNotification: (notification) =>
          notification.type === "incident_opened"
            ? notifier({
                ...notification,
                type: "global_outage_confirmed",
                title: `${monitor.name} is unavailable across monitored regions`,
                message: `A majority of the ${run.expectedRegions.length} configured regions confirmed an outage.`,
                dedupeKey: `${notification.relatedResource.resourceId}:global-outage`,
              })
            : notifier(notification),
      });
    }
    await (deps.updateDailyStat || updateDailyStat)(monitor, aggregateCheck);
  }
  await Runs.updateOne(
    { _id: run._id, status: "finalizing" },
    {
      $set: {
        status: "finalized",
        finalizedAt: now,
        canonicalHealthCheck: aggregateCheck._id,
      },
    },
  );
  return { runId, healthCheck: aggregateCheck, ...result };
};

export const finalizeExpiredRegionalRuns = async (deps = {}) => {
  const Runs = deps.RegionalProbeRun || RegionalProbeRun;
  const now = deps.now || new Date();
  const rows = await Runs.find({
    $or: [
      { status: "pending", deadlineAt: { $lte: now } },
      {
        status: "finalizing",
        finalizingAt: { $lte: new Date(now.getTime() - 60_000) },
      },
    ],
  })
    .select("runId")
    .limit(100)
    .lean();
  const results = [];
  for (const row of rows)
    results.push(await finalizeRegionalRun(row.runId, deps));
  return results.filter(Boolean).length;
};

export const acceptRegionalProbeResult = async (
  jobId,
  agent,
  input,
  deps = {},
) => {
  const Checks = deps.RegionalCheck || RegionalCheck;
  const now = deps.now || new Date();
  const job = await Checks.findById(jobId).select("+leaseToken");
  if (
    !job ||
    job.regionId !== agent.regionId ||
    job.leaseAgentId !== agent.agentId
  )
    return { accepted: false, reason: "job_not_assigned" };
  if (job.jobStatus === "complete") {
    return job.leaseToken === input.leaseToken
      ? { accepted: true, duplicate: true }
      : { accepted: false, reason: "stale_lease" };
  }
  if (
    job.jobStatus !== "leased" ||
    job.leaseToken !== input.leaseToken ||
    !job.leaseUntil ||
    job.leaseUntil < now
  ) {
    return { accepted: false, reason: "stale_lease" };
  }
  const run = await (deps.RegionalProbeRun || RegionalProbeRun)
    .findOne({ runId: job.runId, status: "pending" })
    .lean();
  if (!run) return { accepted: false, reason: "run_closed" };
  const saved = await Checks.findOneAndUpdate(
    {
      _id: job._id,
      jobStatus: "leased",
      leaseAgentId: agent.agentId,
      leaseToken: input.leaseToken,
      leaseUntil: { $gte: now },
    },
    {
      $set: {
        jobStatus: "complete",
        healthStatus: input.healthStatus,
        frontendStatus: input.frontendStatus,
        backendStatus: input.backendStatus,
        databaseStatus: input.databaseStatus,
        responseTime: input.responseTime,
        timings: input.timings,
        httpStatus: input.httpStatus,
        failureReason: input.failureReason,
        checkedAt: input.checkedAt || now,
        completedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!saved) {
    const current = await Checks.findById(jobId)
      .select("jobStatus +leaseToken")
      .lean();
    if (
      current?.jobStatus === "complete" &&
      current.leaseToken === input.leaseToken
    )
      return { accepted: true, duplicate: true };
    return { accepted: false, reason: "stale_lease" };
  }
  Object.assign(job, saved.toObject());
  await updateRegionalIncident(job, deps);
  await evaluateRegionalPerformance(job, deps);
  await finalizeRegionalRun(job.runId, deps);
  return { accepted: true, duplicate: false };
};

export const getRegionalAnalytics = async (
  monitorId,
  query = {},
  deps = {},
) => {
  const Checks = deps.RegionalCheck || RegionalCheck;
  const Incidents = deps.RegionalIncident || RegionalIncident;
  const PerformanceStates =
    deps.RegionalPerformanceState || RegionalPerformanceState;
  const startDate = query.startDate
    ? new Date(query.startDate)
    : new Date(Date.now() - 24 * 60 * 60_000);
  const endDate = query.endDate ? new Date(query.endDate) : new Date();
  const [latest, incidents, agents, performanceStates] = await Promise.all([
    Checks.find({ monitor: monitorId, jobStatus: "complete" })
      .sort({ completedAt: -1 })
      .limit(200)
      .lean(),
    Incidents.find({ monitor: monitorId, status: "ongoing" }).lean(),
    (deps.ProbeAgent || ProbeAgent)
      .find({
        lastHeartbeatAt: { $gte: new Date(Date.now() - AGENT_ONLINE_MS) },
      })
      .select("regionId")
      .lean(),
    PerformanceStates.find({ monitor: monitorId }).lean(),
  ]);
  const onlineRegions = new Set(agents.map((agent) => agent.regionId));
  const Stats =
    endDate - startDate <= 2 * 86_400_000
      ? deps.RegionalHourlyStat || RegionalHourlyStat
      : deps.RegionalDailyStat || RegionalDailyStat;
  const stats = await Stats.find({
    monitor: monitorId,
    date: { $gte: startDate, $lte: endDate },
  })
    .sort({ date: 1 })
    .lean();
  const regions = new Map();
  const seenCurrent = new Set();
  for (const region of PROBE_REGIONS)
    regions.set(region.id, {
      regionId: region.id,
      region,
      currentStatus: "unknown",
      checks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      responseTimeSum: 0,
      responseTimeCount: 0,
      latencyHistograms: {},
    });
  for (const check of latest) {
    const row = regions.get(check.regionId);
    if (row && !seenCurrent.has(check.regionId)) {
      seenCurrent.add(check.regionId);
      row.currentStatus = check.healthStatus;
      row.lastCheckedAt = check.completedAt;
      row.lastResponseTime = check.responseTime;
    }
  }
  for (const stat of stats) {
    const row = regions.get(stat.regionId);
    if (!row) continue;
    row.checks += stat.totalChecks;
    row.successfulChecks += stat.successfulChecks;
    row.failedChecks += stat.failedChecks;
    row.responseTimeSum += stat.responseTimeSum;
    row.responseTimeCount += stat.responseTimeCount;
    for (const [metric, histogram] of Object.entries(
      stat.latencyHistograms || {},
    )) {
      if (metric === "version") continue;
      const target = (row.latencyHistograms[metric] ||= {
        sampleCount: 0,
        buckets: {},
      });
      target.sampleCount += histogram.sampleCount || 0;
      for (const [key, count] of Object.entries(histogram.buckets || {}))
        target.buckets[key] = (target.buckets[key] || 0) + count;
    }
  }
  const trendByDate = new Map();
  for (const stat of stats) {
    const key = new Date(stat.date).toISOString();
    const trend = trendByDate.get(key) || { timestamp: key };
    const response = stat.latencyHistograms?.responseTime;
    trend[stat.regionId] = {
      average: stat.responseTimeCount
        ? Number((stat.responseTimeSum / stat.responseTimeCount).toFixed(2))
        : null,
      p50: estimateHistogram(response, 0.5),
      p95: estimateHistogram(response, 0.95),
      p99: estimateHistogram(response, 0.99),
    };
    trendByDate.set(key, trend);
  }
  return {
    startDate,
    endDate,
    regions: [...regions.values()].map((row) => ({
      ...row,
      agentStatus: onlineRegions.has(row.regionId) ? "online" : "unavailable",
      currentStatus: onlineRegions.has(row.regionId)
        ? row.currentStatus
        : "unknown",
      uptimePercentage: row.checks
        ? Number(((row.successfulChecks / row.checks) * 100).toFixed(2))
        : null,
      averageResponseTime: row.responseTimeCount
        ? Number((row.responseTimeSum / row.responseTimeCount).toFixed(2))
        : null,
      percentiles: Object.fromEntries(
        Object.entries(row.latencyHistograms).map(([metric, histogram]) => [
          metric,
          {
            sampleCount: histogram.sampleCount,
            p50: estimateHistogram(histogram, 0.5),
            p95: estimateHistogram(histogram, 0.95),
            p99: estimateHistogram(histogram, 0.99),
          },
        ]),
      ),
      activeIncident:
        incidents.find((incident) => incident.regionId === row.regionId) ||
        null,
      performanceAlert: performanceStates.find(
        (state) => state.regionId === row.regionId,
      )
        ? {
            status: performanceStates.find(
              (state) => state.regionId === row.regionId,
            ).status,
            baselineMedianMs: performanceStates.find(
              (state) => state.regionId === row.regionId,
            ).baselineMedianMs,
            consecutiveBreaches: performanceStates.find(
              (state) => state.regionId === row.regionId,
            ).consecutiveBreaches,
          }
        : {
            status: "warming_up",
            baselineMedianMs: null,
            consecutiveBreaches: 0,
          },
    })),
    trend: [...trendByDate.values()].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    ),
    recentChecks: latest.slice(0, 40).map((check) => ({
      id: String(check._id),
      regionId: check.regionId,
      status: check.healthStatus,
      responseTime: check.responseTime,
      httpStatus: check.httpStatus,
      completedAt: check.completedAt,
    })),
  };
};

const estimateHistogram = (histogram, percentile) => {
  if (!histogram?.sampleCount) return null;
  const bounds = [
    10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000,
    3000, 5000, 7500, 10000, 15000, 30000, 60000,
  ];
  const target = Math.max(1, Math.ceil(histogram.sampleCount * percentile));
  let count = 0;
  for (const bound of bounds) {
    count += histogram.buckets?.[`le${bound}`] || 0;
    if (count >= target) return bound;
  }
  return count + (histogram.buckets?.gt60000 || 0) >= target ? 60000 : null;
};
