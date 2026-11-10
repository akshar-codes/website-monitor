import { formatDuration } from "./format.js";

export const SLO_WINDOWS = Object.freeze([
  { label: "7 days", value: "7d", seconds: 7 * 86400 },
  { label: "14 days", value: "14d", seconds: 14 * 86400 },
  { label: "30 days", value: "30d", seconds: 30 * 86400 },
  { label: "90 days", value: "90d", seconds: 90 * 86400 },
]);

export const EVALUATION_INTERVALS = Object.freeze([
  { label: "1 minute", value: "1m" },
  { label: "5 minutes", value: "5m" },
  { label: "15 minutes", value: "15m" },
  { label: "1 hour", value: "1h" },
  { label: "6 hours", value: "6h" },
  { label: "24 hours", value: "24h" },
]);

export const TARGET_PRESETS = [99.0, 99.5, 99.9, 99.95, 99.99];

export function getWindowSeconds(windowStr) {
  const found = SLO_WINDOWS.find((w) => w.value === windowStr);
  if (found) return found.seconds;
  const days = parseInt(windowStr, 10);
  return isNaN(days) ? 30 * 86400 : days * 86400;
}

export function calculateAllowableDowntime(targetPct, windowStr) {
  if (targetPct == null || isNaN(targetPct)) return "—";
  const windowSecs = getWindowSeconds(windowStr);
  const errorRate = Math.max(0, (100 - Number(targetPct)) / 100);
  const allowedSecs = Math.round(windowSecs * errorRate);
  return formatDuration(allowedSecs);
}

export function formatBudgetDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return "—";
  const num = Math.round(Number(seconds));
  if (num === 0) return "0s";
  if (num > 0) return `+${formatDuration(num)}`;
  return `-${formatDuration(Math.abs(num))}`;
}

export function formatBurnRate(rate) {
  if (rate == null || isNaN(rate)) return "0.0x";
  return `${Number(rate).toFixed(1)}x`;
}

export function formatPercentage(pct, decimals = 2) {
  if (pct == null || isNaN(pct)) return "—";
  return `${Number(pct).toFixed(decimals)}%`;
}

export function getSloStatus({
  enabled = true,
  sli = null,
  target = 99.9,
  remainingBudgetSeconds = null,
  allowedErrorBudgetSeconds = null,
  dataCoveragePct = 100,
  alertStatus = null,
}) {
  if (!enabled) {
    return {
      status: "disabled",
      label: "Disabled",
      tone: "gray",
      badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
    };
  }

  if (
    alertStatus === "exhausted" ||
    (remainingBudgetSeconds != null && remainingBudgetSeconds <= 0)
  ) {
    return {
      status: "exhausted",
      label: "Budget Exhausted",
      tone: "red",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }

  if (
    alertStatus === "breached" ||
    (sli != null && target != null && Number(sli) < Number(target))
  ) {
    return {
      status: "breached",
      label: "Breached",
      tone: "red",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }

  if (dataCoveragePct != null && Number(dataCoveragePct) < 50) {
    return {
      status: "insufficient_data",
      label: "Insufficient Data",
      tone: "yellow",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  if (
    alertStatus === "warning" ||
    (remainingBudgetSeconds != null &&
      allowedErrorBudgetSeconds != null &&
      allowedErrorBudgetSeconds > 0 &&
      remainingBudgetSeconds / allowedErrorBudgetSeconds < 0.2)
  ) {
    return {
      status: "warning",
      label: "At Risk",
      tone: "yellow",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  return {
    status: "healthy",
    label: "Healthy",
    tone: "green",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
}

export function formatExhaustionHours(hours) {
  if (hours == null || isNaN(hours)) return "N/A";
  if (hours <= 0) return "Already exhausted";
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function getLookbackWindowLabel(window) {
  const map = {
    "5m": "5 Minutes",
    "15m": "15 Minutes",
    "30m": "30 Minutes",
    "1h": "1 Hour",
    "2h": "2 Hours",
    "6h": "6 Hours",
    "12h": "12 Hours",
    "24h": "24 Hours",
    "3d": "3 Days",
  };
  return map[window] || window;
}
