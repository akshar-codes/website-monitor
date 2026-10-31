import HealthCheck from "../models/HealthCheck.js";
import Monitor from "../models/Monitor.js";
import PerformanceAlertState from "../models/PerformanceAlertState.js";
import { enqueuePerformanceNotification } from "./performanceNotificationOutbox.service.js";

export const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};
export const medianAbsoluteDeviation = (values) => {
  const center = median(values);
  return center == null
    ? null
    : median(values.map((value) => Math.abs(value - center)));
};

const sensitivity = {
  low: { multiplier: 2, minIncrease: 100 },
  normal: { multiplier: 1.5, minIncrease: 50 },
  high: { multiplier: 1.25, minIncrease: 25 },
};
const DEFAULTS = {
  minBaselineSamples: 20,
  currentWindow: 5,
  breaches: 3,
  recoveries: 3,
  cooldownMinutes: 30,
};

export async function evaluatePerformanceCheck(monitor, check, deps = {}) {
  if (
    !check.scheduled ||
    check.httpStatus == null ||
    !Number.isFinite(check.responseTime) ||
    monitor.performanceAlerts?.enabled === false
  )
    return null;
  const State = deps.PerformanceAlertState || PerformanceAlertState;
  const Checks = deps.HealthCheck || HealthCheck;
  const enqueue =
    deps.enqueueNotification ||
    (deps.createNotification
      ? (payload) =>
          deps.createNotification({
            ownerId: payload.monitor.owner,
            ...payload,
          })
      : enqueuePerformanceNotification);
  const settings = monitor.performanceAlerts || {};
  const preset = sensitivity[settings.sensitivity] || sensitivity.normal;
  const state = await State.findOneAndUpdate(
    { monitor: monitor._id, metric: "responseTime" },
    {
      $setOnInsert: {
        monitor: monitor._id,
        metric: "responseTime",
        status: "normal",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (String(state.lastEvaluatedCheckId || "") === String(check._id))
    return state;
  if (state.baselineUrl && state.baselineUrl !== monitor.url) {
    state.status = "normal";
    state.baselineMedianMs = null;
    state.baselineMadMs = null;
    state.baselineSamples = [];
    state.recentSamples = [];
    state.consecutiveBreaches = 0;
    state.consecutiveRecoveries = 0;
    state.lastAlertAt = null;
    state.lastNotifiedAt = null;
    state.baselineStartedAt = check.checkedAt;
  }
  state.baselineUrl = monitor.url;
  let baselineValues = [...(state.baselineSamples || [])];
  if (!baselineValues.length) {
    const previous = await Checks.find({
      monitor: monitor._id,
      scheduled: true,
      httpStatus: { $ne: null },
      _id: { $ne: check._id },
      checkedAt: { $lt: check.checkedAt },
      ...(state.baselineStartedAt
        ? { checkedAt: { $gte: state.baselineStartedAt, $lt: check.checkedAt } }
        : {}),
    })
      .sort({ checkedAt: -1 })
      .limit(50)
      .select("responseTime")
      .lean();
    baselineValues = previous
      .reverse()
      .map((sample) => sample.responseTime)
      .filter(Number.isFinite);
  }
  // Persist every warm-up sample in compact state. Raw checks are intentionally
  // capped at ten, so relying on history here prevents the baseline ever
  // reaching the twenty-sample minimum.
  const collectingBaseline =
    state.status !== "degraded" &&
    baselineValues.length < DEFAULTS.minBaselineSamples;
  if (collectingBaseline) {
    baselineValues = [...baselineValues, check.responseTime].slice(-50);
    state.baselineSamples = baselineValues;
    state.recentSamples = [
      ...(state.recentSamples || []),
      check.responseTime,
    ].slice(-DEFAULTS.currentWindow);
    state.lastEvaluatedCheckId = check._id;
    if (baselineValues.length < DEFAULTS.minBaselineSamples) {
      await state.save();
      return state;
    }
  }
  if (
    state.status !== "degraded" &&
    baselineValues.length >= DEFAULTS.minBaselineSamples
  ) {
    state.baselineSamples = baselineValues.slice(-50);
    state.baselineMedianMs = median(state.baselineSamples);
    state.baselineMadMs = medianAbsoluteDeviation(state.baselineSamples);
  }
  if (String(state.lastEvaluatedCheckId || "") !== String(check._id)) {
    state.recentSamples = [
      ...(state.recentSamples || []),
      check.responseTime,
    ].slice(-DEFAULTS.currentWindow);
  }
  const currentMedian = median(state.recentSamples);
  state.lastEvaluatedCheckId = check._id;
  if (
    baselineValues.length < DEFAULTS.minBaselineSamples ||
    state.baselineMedianMs == null
  ) {
    await state.save();
    return state;
  }
  const baseline = state.baselineMedianMs;
  const mad = state.baselineMadMs || 0;
  const threshold = Math.max(
    baseline * (settings.thresholdMultiplier ?? preset.multiplier),
    baseline + 3 * mad,
    baseline + preset.minIncrease,
  );
  const recoveryThreshold = baseline + Math.max(2 * mad, baseline * 0.25, 25);
  const now = new Date();
  if (state.status === "normal") {
    const breached = currentMedian >= threshold;
    state.consecutiveBreaches = breached ? state.consecutiveBreaches + 1 : 0;
    state.consecutiveRecoveries = 0;
    if (!breached && !collectingBaseline) {
      state.baselineSamples = [
        ...(state.baselineSamples || []),
        check.responseTime,
      ].slice(-50);
      state.baselineMedianMs = median(state.baselineSamples);
      state.baselineMadMs = medianAbsoluteDeviation(state.baselineSamples);
    }
    if (
      state.consecutiveBreaches >=
      (settings.consecutiveBreaches || DEFAULTS.breaches)
    ) {
      state.status = "degraded";
      state.lastAlertAt = now;
      state.lastNotifiedAt = now;
      await enqueue({
        monitor,
        type: "performance_degraded",
        eventKey: `${monitor._id}:performance_degraded:${check._id}`,
        title: "Performance degradation detected",
        message: `${monitor.name} is responding significantly slower than its normal baseline. Baseline: ${Math.round(baseline)} ms; current median: ${Math.round(currentMedian)} ms.`,
        priority: "high",
        link: `/monitors/${monitor._id}`,
        relatedResource: { resourceType: "Monitor", resourceId: monitor._id },
        metadata: {
          baselineMedianMs: baseline,
          currentMedianMs: currentMedian,
          increasePercent: baseline
            ? Math.round(((currentMedian - baseline) / baseline) * 100)
            : null,
        },
      });
      await state.save();
      return state;
    }
  } else {
    state.consecutiveRecoveries =
      currentMedian <= recoveryThreshold ? state.consecutiveRecoveries + 1 : 0;
    state.consecutiveBreaches =
      currentMedian >= threshold ? state.consecutiveBreaches + 1 : 0;
    if (state.consecutiveRecoveries >= DEFAULTS.recoveries) {
      state.status = "normal";
      state.consecutiveRecoveries = 0;
      state.consecutiveBreaches = 0;
      state.baselineSamples = [
        ...(state.baselineSamples || []),
        ...state.recentSamples.filter((sample) => sample <= recoveryThreshold),
      ].slice(-50);
      state.baselineMedianMs = median(state.baselineSamples);
      state.baselineMadMs = medianAbsoluteDeviation(state.baselineSamples);
      await enqueue({
        monitor,
        type: "performance_recovered",
        eventKey: `${monitor._id}:performance_recovered:${check._id}`,
        title: "Performance has recovered",
        message: `${monitor.name} response times have returned near their baseline of ${Math.round(baseline)} ms.`,
        priority: "normal",
        link: `/monitors/${monitor._id}`,
        relatedResource: { resourceType: "Monitor", resourceId: monitor._id },
      });
      await state.save();
      return state;
    }
    if (
      state.consecutiveBreaches >= DEFAULTS.breaches &&
      now - new Date(state.lastNotifiedAt || 0) >=
        (settings.cooldownMinutes || DEFAULTS.cooldownMinutes) * 60000
    ) {
      state.lastNotifiedAt = now;
      state.lastAlertAt = now;
      await enqueue({
        monitor,
        type: "performance_degraded",
        eventKey: `${monitor._id}:performance_degraded_repeat:${check._id}`,
        title: "Performance degradation continues",
        message: `${monitor.name} remains above its response-time baseline.`,
        priority: "high",
        link: `/monitors/${monitor._id}`,
        relatedResource: { resourceType: "Monitor", resourceId: monitor._id },
      });
    }
  }
  await state.save();
  return state;
}

export async function getPerformanceState(monitorId, ownerId) {
  const monitor = await Monitor.findOne({ _id: monitorId, owner: ownerId })
    .select("_id")
    .lean();
  if (!monitor) return null;
  return PerformanceAlertState.findOne({
    monitor: monitor._id,
    metric: "responseTime",
  }).lean();
}
