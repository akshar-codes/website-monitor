/**
 * Format and map deployment data for UI components and Recharts visualizations.
 */

/**
 * Truncates commit SHA to 7 characters for clean UI presentation.
 */
export function shortCommitSha(sha) {
  if (!sha || typeof sha !== "string") return null;
  return sha.trim().slice(0, 7);
}

/**
 * Maps an environment name to appropriate UI badge styles.
 */
export function getEnvironmentBadgeStyle(environment = "production") {
  const env = String(environment || "")
    .trim()
    .toLowerCase();
  switch (env) {
    case "production":
    case "prod":
      return {
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
        dotColor: "#10b981",
        label: "Production",
      };
    case "staging":
    case "stage":
      return {
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
        dotColor: "#f59e0b",
        label: "Staging",
      };
    case "development":
    case "dev":
      return {
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
        dotColor: "#3b82f6",
        label: "Development",
      };
    case "canary":
      return {
        badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
        dotColor: "#8b5cf6",
        label: "Canary",
      };
    default:
      return {
        badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
        dotColor: "#64748b",
        label: environment,
      };
  }
}

/**
 * Aligns deployment events with the Recharts response-time chart.
 * Uses chartPoints timestamp boundaries and maps deployments to matching categorical `day` buckets.
 * Deployments outside the chart window are discarded so the chart scale/ticks are never distorted.
 */
export function mapDeploymentsToChart(
  deployments = [],
  chart = [],
  chartPoints = [],
  window = "24h",
) {
  if (!deployments.length || !chart.length || !chartPoints.length) {
    return { markers: [], bucketDeploymentsMap: new Map() };
  }

  const bucketDurationMs =
    window === "24h" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const bucketMap = new Map(); // dayKey -> Deployment[]

  const firstTimestamp = new Date(chartPoints[0].timestamp).getTime();
  const lastTimestamp =
    new Date(chartPoints[chartPoints.length - 1].timestamp).getTime() +
    bucketDurationMs;

  for (const dep of deployments) {
    const depTime = new Date(dep.deployedAt).getTime();
    if (isNaN(depTime)) continue;

    // Reject deployments outside the active chart window
    if (depTime < firstTimestamp || depTime >= lastTimestamp) {
      continue;
    }

    // Find bucket in chartPoints
    let matchedIndex = -1;
    for (let i = 0; i < chartPoints.length; i++) {
      const bStart = new Date(chartPoints[i].timestamp).getTime();
      const bEnd =
        i < chartPoints.length - 1
          ? new Date(chartPoints[i + 1].timestamp).getTime()
          : bStart + bucketDurationMs;

      if (depTime >= bStart && depTime < bEnd) {
        matchedIndex = i;
        break;
      }
    }

    // Fallback: nearest bucket within tolerance
    if (matchedIndex === -1) {
      let minDiff = Infinity;
      for (let i = 0; i < chartPoints.length; i++) {
        const bStart = new Date(chartPoints[i].timestamp).getTime();
        const diff = Math.abs(depTime - bStart);
        if (diff < minDiff && diff < bucketDurationMs) {
          minDiff = diff;
          matchedIndex = i;
        }
      }
    }

    if (matchedIndex >= 0 && matchedIndex < chart.length) {
      const dayKey = chart[matchedIndex].day;
      if (!bucketMap.has(dayKey)) {
        bucketMap.set(dayKey, []);
      }
      bucketMap.get(dayKey).push(dep);
    }
  }

  // Generate reference markers
  const markers = [];
  for (const [day, deps] of bucketMap.entries()) {
    markers.push({
      day,
      count: deps.length,
      deployments: deps,
      latest: deps[0],
    });
  }

  return { markers, bucketDeploymentsMap: bucketMap };
}
