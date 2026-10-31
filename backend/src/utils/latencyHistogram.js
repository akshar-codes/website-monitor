export const LATENCY_HISTOGRAM_VERSION = 2;
export const LATENCY_BUCKET_UPPER_BOUNDS = Object.freeze([
  10, 20, 30, 40, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000,
  3000, 5000, 7500, 10000, 15000, 30000, 60000,
]);
export const LATENCY_METRICS = Object.freeze([
  "responseTime",
  "dnsMs",
  "tcpConnectMs",
  "tlsHandshakeMs",
  "ttfbMs",
]);

export const latencyBucketKey = (value) => {
  const upper = LATENCY_BUCKET_UPPER_BOUNDS.find((bound) => value <= bound);
  return upper == null ? "gt60000" : `le${upper}`;
};
const readTiming = (check, metric) => {
  if (metric === "responseTime")
    return check.httpStatus != null ? Number(check.responseTime) : null;
  const fromStructured = check.timings?.[metric];
  if (Number.isFinite(Number(fromStructured)) && fromStructured != null)
    return Number(fromStructured);
  if (metric === "dnsMs") {
    const legacy =
      check.diagnostics?.timing?.dnsMs ?? check.diagnostics?.dns?.durationMs;
    if (Number.isFinite(Number(legacy)) && legacy != null)
      return Number(legacy);
  }
  return null;
};

export function buildLatencyHistograms(checks = []) {
  const result = { version: LATENCY_HISTOGRAM_VERSION };
  for (const metric of LATENCY_METRICS) {
    const buckets = {};
    let sampleCount = 0;
    for (const check of checks) {
      const value = readTiming(check, metric);
      if (!Number.isFinite(value) || value < 0) continue;
      const key = latencyBucketKey(value);
      buckets[key] = (buckets[key] || 0) + 1;
      sampleCount += 1;
    }
    result[metric] = { sampleCount, buckets };
  }
  return result;
}

export function estimatePercentile(histogram, percentile) {
  if (
    !histogram ||
    !Number.isFinite(histogram.sampleCount) ||
    histogram.sampleCount === 0
  )
    return null;
  const target = Math.max(1, Math.ceil(histogram.sampleCount * percentile));
  let cumulative = 0;
  for (const upper of LATENCY_BUCKET_UPPER_BOUNDS) {
    cumulative += histogram.buckets?.[`le${upper}`] || 0;
    if (cumulative >= target) return upper;
  }
  cumulative += histogram.buckets?.gt60000 || 0;
  return cumulative >= target ? 60000 : null;
}

export function addToHistogram(histogram, value) {
  if (!Number.isFinite(value) || value < 0) return histogram;
  const key = latencyBucketKey(value);
  histogram.sampleCount += 1;
  histogram.buckets[key] = (histogram.buckets[key] || 0) + 1;
  return histogram;
}
