import { formatDistanceToNow, format, parseISO } from "date-fns";

/**
 * Format milliseconds to human-readable response time
 */
export function formatResponseTime(ms) {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format uptime percentage with appropriate precision
 */
export function formatUptime(pct) {
  if (pct == null) return "—";
  if (pct === 100) return "100%";
  if (pct >= 99.9) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

/**
 * Format seconds to "2h 15m 30s"
 */
export function formatDuration(seconds) {
  if (seconds == null) return "Ongoing";
  if (seconds === 0) return "0s";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(" ");
}

/**
 * Format a date as relative time ("3 minutes ago")
 */
export function formatRelative(date) {
  if (!date) return "Never";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

/**
 * Format a date as absolute timestamp
 */
export function formatDateTime(date, fmt = "MMM d, yyyy HH:mm") {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    return format(d, fmt);
  } catch {
    return "—";
  }
}

/**
 * Format a date as short date
 */
export function formatDate(date) {
  return formatDateTime(date, "MMM d, yyyy");
}

/**
 * Format chart axis date labels
 */
export function formatChartDate(dateStr, window) {
  try {
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    if (window === "24h") return format(d, "HH:mm");
    if (window === "7d") return format(d, "EEE");
    return format(d, "MMM d");
  } catch {
    return dateStr;
  }
}

/**
 * Format interval presets to human-readable
 */
export function formatInterval(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${seconds / 60}m`;
  return `${seconds / 3600}h`;
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url, maxLength = 40) {
  if (!url) return "—";
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
    if (display.length <= maxLength) return display;
    return display.substring(0, maxLength) + "…";
  } catch {
    return url.length <= maxLength ? url : url.substring(0, maxLength) + "…";
  }
}

/**
 * Get domain from URL
 */
export function getDomain(url) {
  if (!url) return "—";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}