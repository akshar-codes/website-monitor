import { format, parseISO } from "date-fns";

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
    const seconds = Math.round((d.getTime() - Date.now()) / 1000);
    const units = [
      [60, "second"],
      [3600, "minute"],
      [86400, "hour"],
      [604800, "day"],
      [2629800, "week"],
      [31557600, "month"],
      [Infinity, "year"],
    ];
    let value = seconds;
    let unit = "second";
    for (let i = 0; i < units.length; i++) {
      if (Math.abs(seconds) < units[i][0]) {
        unit = units[i][1];
        if (i > 0) value = Math.round(seconds / units[i - 1][0]);
        break;
      }
    }
    const locale =
      typeof document !== "undefined"
        ? document.documentElement.lang || "en"
        : "en";
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      value,
      unit,
    );
  } catch {
    return "Unknown";
  }
}

/**
 * Format a date as absolute timestamp
 */
export function formatDateTime(date, fmt) {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    if (fmt) return format(d, fmt);
    const root =
      typeof document !== "undefined" ? document.documentElement : null;
    const pattern = root?.dataset.dateFormat || "MMM D, YYYY";
    const timeFormat = root?.dataset.timeFormat || "12h";
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat(root?.lang || "en", {
        timeZone: root?.dataset.timezone || "UTC",
        year: "numeric",
        month: pattern === "MMM D, YYYY" ? "short" : "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: timeFormat !== "24h",
      })
        .formatToParts(d)
        .map(({ type, value }) => [type, value]),
    );
    const formattedDate =
      pattern === "YYYY-MM-DD"
        ? `${parts.year}-${parts.month}-${parts.day}`
        : pattern === "DD/MM/YYYY"
          ? `${parts.day}/${parts.month}/${parts.year}`
          : pattern === "MM/DD/YYYY"
            ? `${parts.month}/${parts.day}/${parts.year}`
            : `${parts.month} ${parts.day.replace(/^0/, "")}, ${parts.year}`;
    const formattedTime =
      timeFormat === "24h"
        ? `${parts.hour}:${parts.minute}`
        : `${parts.hour}:${parts.minute} ${parts.dayPeriod || ""}`.trim();
    return `${formattedDate} ${formattedTime}`;
  } catch {
    return "—";
  }
}

/**
 * Format a date as short date
 */
export function formatDate(date) {
  if (!date) return "â€”";
  try {
    const d = typeof date === "string" ? parseISO(date) : new Date(date);
    const root =
      typeof document !== "undefined" ? document.documentElement : null;
    const pattern = root?.dataset.dateFormat || "MMM D, YYYY";
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat(root?.lang || "en", {
        timeZone: root?.dataset.timezone || "UTC",
        year: "numeric",
        month: pattern === "MMM D, YYYY" ? "short" : "2-digit",
        day: "2-digit",
      })
        .formatToParts(d)
        .map(({ type, value }) => [type, value]),
    );
    if (pattern === "YYYY-MM-DD")
      return `${parts.year}-${parts.month}-${parts.day}`;
    if (pattern === "DD/MM/YYYY")
      return `${parts.day}/${parts.month}/${parts.year}`;
    if (pattern === "MM/DD/YYYY")
      return `${parts.month}/${parts.day}/${parts.year}`;
    return `${parts.month} ${parts.day.replace(/^0/, "")}, ${parts.year}`;
  } catch {
    return "â€”";
  }
}

/**
 * Format chart axis date labels
 */
export function formatChartDate(dateStr, window) {
  try {
    const d =
      typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    const root =
      typeof document !== "undefined" ? document.documentElement : null;
    const options =
      window === "24h"
        ? {
            hour: "2-digit",
            minute: "2-digit",
            hour12: root?.dataset.timeFormat !== "24h",
          }
        : window === "7d"
          ? { weekday: "short" }
          : {
              month:
                root?.dataset.dateFormat === "MMM D, YYYY"
                  ? "short"
                  : "2-digit",
              day: "2-digit",
            };
    return new Intl.DateTimeFormat(root?.lang || "en", {
      ...options,
      timeZone: root?.dataset.timezone || "UTC",
    }).format(d);
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
    const display =
      parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
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
